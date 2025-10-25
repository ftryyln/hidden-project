import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import {
  listGuildUserRoles,
  updateGuildUserRole,
  syncUserAppRole,
} from "../services/guild-user-roles.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import { z } from "zod";
import { ApiError } from "../errors.js";

const router = Router();

router.get(
  "/guilds/:guildId/access",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, [
      "guild_admin",
      "officer",
    ]);
    const roles = await listGuildUserRoles(guildId);
    res.json(roles);
  }),
);

const roleEnum = z.enum(["guild_admin", "officer", "raider", "member", "viewer"]);

const updateSchema = z.object({
  role: roleEnum,
});

const assignSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    role: roleEnum.default("member"),
  })
  .refine((value) => Boolean(value.user_id) || Boolean(value.email), {
    message: "Either user_id or email is required",
    path: ["user_id"],
  });

router.post(
  "/guilds/:guildId/access",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin"]);

    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const payload = parsed.data;
    let targetUserId = payload.user_id ?? null;

    if (!targetUserId && payload.email) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", payload.email)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to look up user by email", profileError);
        throw new ApiError(500, "Unable to locate user by email");
      }

      if (!profile) {
        throw new ApiError(404, "User not found for the provided email");
      }

      targetUserId = profile.id as string;
    }

    if (!targetUserId) {
      throw new ApiError(400, "validation error", {
        user_id: "Unable to resolve user identifier",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("guild_user_roles")
      .upsert(
        {
          guild_id: guildId,
          user_id: targetUserId,
          role: payload.role,
        },
        { onConflict: "guild_id,user_id" },
      )
      .select(
        "guild_id, user_id, role, created_at, profiles:profiles!guild_user_roles_user_id_fkey(display_name, email)",
      )
      .maybeSingle();

    if (error) {
      console.error("Failed to upsert guild user role", error);
      throw new ApiError(500, "Unable to assign access to guild");
    }

    if (!data) {
      throw new ApiError(500, "Guild user role assignment failed");
    }

    await syncUserAppRole(targetUserId);

    const profile = Array.isArray(data.profiles) ? data.profiles?.[0] : data.profiles;
    res.status(200).json({
      guild_id: data.guild_id as string,
      user_id: data.user_id as string,
      role: data.role,
      user: {
        email: profile?.email ?? undefined,
        display_name: profile?.display_name ?? undefined,
      },
    });
  }),
);

router.patch(
  "/guilds/:guildId/access/:userId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const userId = ensureUuid(req.params.userId, "userId");
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }
    const result = await updateGuildUserRole(guildId, userId, parsed.data.role, req.user!.id);
    res.json(result);
  }),
);

export const guildAccessRouter = router;
