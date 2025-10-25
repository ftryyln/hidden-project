import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { supabaseAdmin, supabaseAuth } from "../supabase.js";
import { ApiError } from "../errors.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const seedAdminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@valhalla.gg";
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Valhalla!23";

async function ensureSeedAdmin(email: string, password: string) {
  if (email !== seedAdminEmail || password !== seedAdminPassword) {
    return;
  }

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1);
  let userId = profiles?.[0]?.id ?? null;

  if (!userId) {
    const createResult = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "guild_admin" },
      user_metadata: { display_name: "Seed Admin" },
    });
    if (createResult.error || !createResult.data?.user?.id) {
      console.error("Failed to create seed admin", createResult.error);
      throw new ApiError(500, "Unable to provision default admin account");
    }
    userId = createResult.data.user.id;
  } else {
    const updateResult = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
      app_metadata: { role: "guild_admin" },
      user_metadata: { display_name: "Seed Admin" },
      email_confirm: true,
    });
    if (updateResult.error) {
      console.warn("Failed to update seed admin metadata", updateResult.error);
    }
  }

  if (!userId) {
    throw new ApiError(500, "Unable to provision default admin account");
  }

  const profilePayload = {
    id: userId,
    email,
    display_name: "Seed Admin",
  };

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(profilePayload);
  if (profileError) {
    console.warn("Failed to upsert admin profile row", profileError);
  }

  const { data: guilds, error: guildError } = await supabaseAdmin.from("guilds").select("id");
  if (guildError) {
    console.warn("Failed to fetch guilds for admin provisioning", guildError);
    return;
  }

  if (guilds && guilds.length > 0) {
    const upsertPayload = guilds.map((guild) => ({
      guild_id: guild.id,
      user_id: userId,
      role: "guild_admin" as const,
    }));
    const { error: roleError } = await supabaseAdmin
      .from("guild_user_roles")
      .upsert(upsertPayload, { onConflict: "guild_id,user_id" });
    if (roleError) {
      console.warn("Failed to upsert admin guild roles", roleError);
    }
  }
}

router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const { email, password } = parsed.data;
    let { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      try {
        await ensureSeedAdmin(email, password);
        const retry = await supabaseAuth.auth.signInWithPassword({
          email,
          password,
        });
        data = retry.data;
        error = retry.error;
      } catch (provisionError) {
        if (provisionError instanceof ApiError) {
          throw provisionError;
        }
        console.error("Failed to provision seed admin", provisionError);
      }
    }

    if (error || !data?.session) {
      throw new ApiError(401, error?.message ?? "Invalid credentials");
    }

    const session = data.session;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Failed to load profile during login", profileError);
    }

    res.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at ?? null,
      token_type: session.token_type,
      user: {
        id: profile?.id ?? session.user.id,
        email: profile?.email ?? session.user.email ?? email,
        display_name:
          profile?.display_name ??
          (session.user.user_metadata as Record<string, string> | undefined)?.display_name ??
          session.user.email ??
          email,
        app_role: session.user.app_metadata?.role ?? null,
      },
    });
  }),
);

const refreshSchema = z.object({
  refresh_token: z.string().min(10),
});

router.post(
  "/auth/refresh",
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const { refresh_token } = parsed.data;
    const { data, error } = await supabaseAuth.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      throw new ApiError(401, error?.message ?? "Invalid refresh token");
    }

    const session = data.session;

    res.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at ?? null,
      token_type: session.token_type,
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        display_name:
          (session.user.user_metadata as Record<string, string> | undefined)?.display_name ??
          session.user.email ??
          "",
        app_role: session.user.app_metadata?.role ?? null,
      },
    });
  }),
);

router.post(
  "/auth/logout",
  asyncHandler(async (_req, res) => {
    res.status(204).send();
  }),
);

router.get(
  "/auth/me",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user!;

    const [{ data: profile, error: profileError }, { data: guildRoles, error: rolesError }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, email, display_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin.from("guild_user_roles").select("guild_id, role").eq("user_id", user.id),
      ]);

    if (profileError) {
      console.warn("Failed to load profile record; falling back to auth data.", profileError);
    }
    if (rolesError) {
      console.warn("Failed to load guild roles for profile", rolesError);
    }

    const resolvedProfile = profile ?? {
      id: user.id,
      email: user.email ?? "",
      display_name:
        (user.user_metadata as Record<string, string> | undefined)?.display_name ??
        user.email ??
        "",
    };

    res.json({
      id: resolvedProfile.id,
      email: resolvedProfile.email ?? user.email ?? "",
      display_name:
        resolvedProfile.display_name ??
        (user.user_metadata as Record<string, string> | undefined)?.display_name ??
        user.email ??
        "",
      app_role: user.app_metadata?.role ?? null,
      guild_roles: guildRoles ?? [],
    });
  }),
);

export const authRouter = router;
