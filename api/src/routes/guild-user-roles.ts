
import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ensureUuid } from "../utils/validation.js";
import {
  listGuildUserRoles,
  assignGuildUserRole,
  revokeGuildUserRole,
} from "../services/guild-user-roles.js";
import { requireGuildRole } from "../services/access.js";
import { supabaseAdmin } from "../supabase.js";
import {
  createGuildInvite,
  listGuildInvites,
  revokeGuildInvite,
} from "../services/invites.js";
import { ApiError } from "../errors.js";
import { listGuildAuditLogs } from "../services/audit.js";
import type { AuditAction, GuildRole } from "../types.js";

const router = Router();

const roleEnum = z.enum(["guild_admin", "officer", "raider", "member", "viewer"]);

const assignSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
    role: roleEnum,
  })
  .refine((value) => Boolean(value.user_id) || Boolean(value.email), {
    message: "Either user_id or email is required",
    path: ["user_id"],
  });

const updateSchema = z.object({
  role: roleEnum,
});

const inviteSchema = z.object({
  email: z.string().email().optional(),
  default_role: roleEnum,
  expires_at: z.string().datetime().optional(),
});

router.get(
  "/guilds/:guildId/access",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin", "officer"]);
    const assignments = await listGuildUserRoles(guildId);
    res.json(assignments);
  }),
);

router.post(
  "/guilds/:guildId/access",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const actorId = req.user!.id;
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);

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

      targetUserId = profile?.id as string | undefined ?? null;
    }

    if (targetUserId) {
      const assignment = await assignGuildUserRole(
        guildId,
        targetUserId,
        payload.role as GuildRole,
        actorId,
        { source: "manual" },
      );
      res.status(201).json({
        type: "assignment",
        assignment,
      });
      return;
    }

    if (!payload.email) {
      throw new ApiError(400, "validation error", {
        email: "Email is required when assigning to a new user",
      });
    }

    const invite = await createGuildInvite(guildId, actorId, {
      email: payload.email,
      defaultRole: payload.role as GuildRole,
      metadata: { auto_accept: true },
    });

    res.status(202).json({
      type: "invite",
      invite: {
        id: invite.id,
        email: invite.email,
        default_role: invite.default_role,
        expires_at: invite.expires_at,
        status: invite.status,
        created_at: invite.created_at,
        created_by_user_id: invite.created_by_user_id,
        token: invite.token,
        invite_url: invite.invite_url,
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
    const actorId = req.user!.id;
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const assignment = await assignGuildUserRole(
      guildId,
      userId,
      parsed.data.role as GuildRole,
      actorId,
      { source: "manual" },
    );

    res.json(assignment);
  }),
);

router.delete(
  "/guilds/:guildId/access/:userId",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const userId = ensureUuid(req.params.userId, "userId");
    const actorId = req.user!.id;
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);

    await revokeGuildUserRole(guildId, userId, actorId);
    res.status(204).send();
  }),
);

router.get(
  "/guilds/:guildId/invites",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin"]);
    const invites = await listGuildInvites(guildId);
    res.json(invites);
  }),
);

router.post(
  "/guilds/:guildId/invites",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const actorId = req.user!.id;
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);

    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(422, "validation error", parsed.error.flatten().fieldErrors);
    }

    const invite = await createGuildInvite(guildId, actorId, {
      email: parsed.data.email,
      defaultRole: parsed.data.default_role as GuildRole,
      expiresAt: parsed.data.expires_at,
    });

    res.status(201).json(invite);
  }),
);

router.post(
  "/guilds/:guildId/invites/:inviteId/revoke",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const inviteId = ensureUuid(req.params.inviteId, "inviteId");
    await requireGuildRole(supabaseAdmin, req.user!.id, guildId, ["guild_admin"]);
    await revokeGuildInvite(guildId, inviteId, req.user!.id);
    res.status(204).send();
  }),
);

router.get(
  "/guilds/:guildId/audit-logs",
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const guildId = ensureUuid(req.params.guildId, "guildId");
    const actorId = req.user!.id;
    await requireGuildRole(supabaseAdmin, actorId, guildId, [
      "guild_admin",
      "officer",
      "raider",
      "member",
      "viewer",
    ]);

    const actions =
      typeof req.query.actions === "string" && req.query.actions.length > 0
        ? (req.query.actions.split(",").filter(Boolean) as AuditAction[])
        : undefined;

    const cursor =
      typeof req.query.cursor === "string" && req.query.cursor.length > 0
        ? req.query.cursor
        : undefined;

    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const logs = await listGuildAuditLogs(guildId, actorId, {
      actions,
      cursor,
      limit,
    });

    res.json(logs);
  }),
);

export const guildAccessRouter = router;
