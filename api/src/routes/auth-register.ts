import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async-handler.js";
import { supabaseAdmin, supabaseAuth } from "../supabase.js";
import { ApiError } from "../errors.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { config } from "../env.js";
import type { GuildRole } from "../types.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().min(1).max(120).optional(),
  invite_token: z.string().uuid().optional(),
});

router.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation error",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email, password, display_name, invite_token } = parsed.data;

    const displayName = display_name ?? email.split("@")[0];
    const registrationRedirect =
      config.registrationRedirectUrl ??
      `${config.frontendUrl.replace(/\/$/, "")}/login`;

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        ...(registrationRedirect
          ? { emailRedirectTo: registrationRedirect }
          : {}),
        data: {
          display_name: displayName,
        },
      },
    });

    if (error || !data.user) {
      throw new ApiError(
        error?.status ?? 400,
        error?.message ?? "Unable to register",
      );
    }

    const userId = data.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        display_name: displayName,
      });
    if (profileError) {
      console.warn(
        "Failed to upsert profile during registration",
        profileError,
      );
    }

    let assignedAppRole: GuildRole = "member";

    if (invite_token) {
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("guild_invites")
        .select("guild_id, default_role, valid_until, max_uses, uses")
        .eq("id", invite_token)
        .maybeSingle();

      if (
        !inviteError &&
        invite &&
        (!invite.valid_until || new Date(invite.valid_until) > new Date())
      ) {
        if (!invite.max_uses || (invite.uses ?? 0) < invite.max_uses) {
          const role = (invite.default_role ?? "member") as GuildRole;
          await supabaseAdmin.from("guild_user_roles").upsert(
            {
              guild_id: invite.guild_id,
              user_id: userId,
              role,
            },
            { onConflict: "guild_id,user_id" },
          );
          await supabaseAdmin
            .from("guild_invites")
            .update({ uses: (invite.uses ?? 0) + 1 })
            .eq("id", invite_token);
          assignedAppRole = role;
        }
      }
    }

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        role: assignedAppRole,
      },
    });

    const session = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (session.error || !session.data.session) {
      throw new ApiError(
        400,
        session.error?.message ?? "Unable to authenticate after registration",
      );
    }

    const user = session.data.session.user;

    res.json({
      access_token: session.data.session.access_token,
      refresh_token: session.data.session.refresh_token,
      expires_in: session.data.session.expires_in,
      expires_at: session.data.session.expires_at ?? null,
      user: {
        id: user.id,
        email: user.email ?? email,
        display_name:
          (user.user_metadata as Record<string, string> | undefined)
            ?.display_name ??
          displayName ??
          email,
        app_role: user.app_metadata?.role ?? null,
      },
    });
  }),
);

const forgotSchema = z.object({
  email: z.string().email(),
});

router.post(
  "/auth/forgot",
  asyncHandler(async (req, res) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation error",
        parsed.error.flatten().fieldErrors,
      );
    }

    const redirectUrl =
      config.resetPasswordRedirectUrl ??
      `${config.frontendUrl.replace(/\/$/, "")}/reset-password`;

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: redirectUrl,
      },
    );
    if (error) {
      throw new ApiError(
        error.status ?? 400,
        error.message ?? "Unable to send reset email",
      );
    }

    res.json({ message: "Reset link sent" });
  }),
);

const resetSchema = z
  .object({
    code: z.string().min(1).optional(),
    access_token: z.string().min(1).optional(),
    refresh_token: z.string().min(1).optional(),
    new_password: z.string().min(6),
  })
  .refine((payload) => Boolean(payload.code) || Boolean(payload.access_token), {
    message: "Missing reset token",
    path: ["code"],
  });

router.post(
  "/auth/reset",
  asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(
        422,
        "validation error",
        parsed.error.flatten().fieldErrors,
      );
    }

    const { code, access_token, refresh_token, new_password } = parsed.data;

    let session: Awaited<
      ReturnType<typeof supabaseAuth.auth.getSession>
    >["data"]["session"] | null = null;

    if (code) {
      const exchange = await supabaseAuth.auth.exchangeCodeForSession(code);
      if (exchange.error || !exchange.data.session) {
        throw new ApiError(
          400,
          exchange.error?.message ?? "Invalid or expired reset code",
        );
      }
      session = exchange.data.session;
    } else if (access_token) {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabaseAuth.auth.setSession({
        access_token,
        refresh_token: refresh_token ?? undefined,
      });
      if (sessionError || !sessionData.session) {
        throw new ApiError(
          sessionError?.status ?? 400,
          sessionError?.message ?? "Invalid or expired reset token",
        );
      }
      session = sessionData.session;
    }

    if (!session) {
      throw new ApiError(400, "Invalid reset payload");
    }
    const { error: updateError } = await supabaseAuth.auth.updateUser({
      password: new_password,
    });
    if (updateError) {
      throw new ApiError(
        updateError.status ?? 400,
        updateError.message ?? "Unable to update password",
      );
    }

    res.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at ?? null,
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        display_name:
          (session.user.user_metadata as Record<string, string> | undefined)
            ?.display_name ??
          session.user.email ??
          "",
        app_role: session.user.app_metadata?.role ?? null,
      },
    });
  }),
);

router.get(
  "/auth/register/invite/:token",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const token = req.params.token;
    const user = req.user!;

    const { data: invite, error } = await supabaseAdmin
      .from("guild_invites")
      .select("guild_id, default_role, valid_until, max_uses, uses")
      .eq("id", token)
      .maybeSingle();

    if (error || !invite) {
      throw new ApiError(404, "Invite not found or expired");
    }

    if (invite.valid_until && new Date(invite.valid_until) < new Date()) {
      throw new ApiError(400, "Invite has expired");
    }

    if (invite.max_uses && (invite.uses ?? 0) >= invite.max_uses) {
      throw new ApiError(400, "Invite has been used up");
    }

    const defaultRole = invite.default_role ?? "member";
    const { error: upsertError } = await supabaseAdmin
      .from("guild_user_roles")
      .upsert(
        {
          guild_id: invite.guild_id,
          user_id: user.id,
          role: defaultRole,
        },
        { onConflict: "guild_id,user_id" },
      );

    if (upsertError) {
      throw new ApiError(500, "Failed to apply invite to guild");
    }

    await supabaseAdmin
      .from("guild_invites")
      .update({ uses: (invite.uses ?? 0) + 1 })
      .eq("id", token);

    res.json({ guild_id: invite.guild_id, role: defaultRole });
  }),
);

export const authRegisterRouter = router;
