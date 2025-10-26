import crypto from "node:crypto";
import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { recordAuditLog } from "./audit.js";
import { assignGuildUserRole } from "./guild-user-roles.js";
import { requireGuildRole, userIsSuperAdmin } from "./access.js";
import type { GuildRole, InviteStatus } from "../types.js";

export interface GuildInvite {
  id: string;
  guild_id: string;
  email?: string | null;
  default_role: GuildRole;
  expires_at: string;
  created_at: string;
  updated_at: string;
  status: InviteStatus;
  created_by_user_id: string;
  used_at?: string | null;
  used_by_user_id?: string | null;
  metadata: Record<string, unknown>;
}

export interface InviteWithSecret extends GuildInvite {
  token: string;
}

export interface CreateInvitePayload {
  email?: string;
  defaultRole: GuildRole;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_EXPIRATION_DAYS = 7;

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resolveExpiration(expiresAt?: string): string {
  if (expiresAt) {
    return new Date(expiresAt).toISOString();
  }
  const expires = new Date();
  expires.setDate(expires.getDate() + DEFAULT_EXPIRATION_DAYS);
  return expires.toISOString();
}

export async function listGuildInvites(guildId: string): Promise<GuildInvite[]> {
  const { data, error } = await supabaseAdmin
    .from("guild_invites")
    .select(
      "id, guild_id, email, default_role, expires_at, created_at, updated_at, status, created_by_user_id, used_at, used_by_user_id, metadata",
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load guild invites", error);
    throw new ApiError(500, "Unable to load invites");
  }

  return (
    data?.map((row) => ({
      id: row.id as string,
      guild_id: row.guild_id as string,
      email: row.email ?? null,
      default_role: row.default_role as GuildRole,
      expires_at: row.expires_at as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      status: row.status as InviteStatus,
      created_by_user_id: row.created_by_user_id as string,
      used_at: row.used_at ?? null,
      used_by_user_id: row.used_by_user_id ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    })) ?? []
  );
}

export async function createGuildInvite(
  guildId: string,
  actorId: string,
  payload: CreateInvitePayload,
): Promise<InviteWithSecret> {
  if (!(await userIsSuperAdmin(actorId))) {
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);
  }

  const token = generateInviteToken();
  const tokenHash = hashToken(token);
  const expiresAt = resolveExpiration(payload.expiresAt);
  const metadata = payload.metadata ?? {};

  if (payload.email) {
    // Supersede existing pending invites for this email.
    const { error: supersedeError } = await supabaseAdmin
      .from("guild_invites")
      .update({ status: "superseded" })
      .eq("guild_id", guildId)
      .eq("email", payload.email)
      .in("status", ["pending", "superseded"]);
    if (supersedeError) {
      console.warn("Failed to supersede existing invites", supersedeError);
    }
  }

  const { data, error } = await supabaseAdmin
    .from("guild_invites")
    .insert({
      guild_id: guildId,
      email: payload.email ?? null,
      token_hash: tokenHash,
      default_role: payload.defaultRole,
      expires_at: expiresAt,
      created_by_user_id: actorId,
      status: "pending",
      metadata,
    })
    .select(
      "id, guild_id, email, default_role, expires_at, created_at, updated_at, status, created_by_user_id, used_at, used_by_user_id, metadata",
    )
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to create guild invite", error);
    throw new ApiError(500, "Unable to create invite");
  }

  await recordAuditLog(supabaseAdmin, {
    guildId,
    actorUserId: actorId,
    targetUserId: null,
    action: "INVITE_CREATED",
    metadata: {
      invite_id: data.id,
      email: data.email,
      default_role: data.default_role,
      expires_at: data.expires_at,
    },
  });

  return {
    id: data.id as string,
    guild_id: data.guild_id as string,
    email: data.email ?? null,
    default_role: data.default_role as GuildRole,
    expires_at: data.expires_at as string,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    status: data.status as InviteStatus,
    created_by_user_id: data.created_by_user_id as string,
    used_at: data.used_at ?? null,
    used_by_user_id: data.used_by_user_id ?? null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    token,
  };
}

export async function revokeGuildInvite(
  guildId: string,
  inviteId: string,
  actorId: string,
): Promise<void> {
  if (!(await userIsSuperAdmin(actorId))) {
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);
  }

  const { data, error } = await supabaseAdmin
    .from("guild_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("guild_id", guildId)
    .select("id, email, default_role")
    .maybeSingle();

  if (error) {
    console.error("Failed to revoke invite", error);
    throw new ApiError(500, "Unable to revoke invite");
  }

  if (!data) {
    throw new ApiError(404, "Invite not found");
  }

  await recordAuditLog(supabaseAdmin, {
    guildId,
    actorUserId: actorId,
    targetUserId: null,
    action: "INVITE_REVOKED",
    metadata: {
      invite_id: data.id,
      email: data.email,
      default_role: data.default_role,
    },
  });
}

async function resolveInviteByTokenHash(tokenHash: string) {
  const { data, error } = await supabaseAdmin
    .from("guild_invites")
    .select(
      "id, guild_id, email, default_role, expires_at, status, metadata, used_at, used_by_user_id, created_by_user_id",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("Failed to load invite by token", error);
    throw new ApiError(500, "Unable to load invite");
  }
  return data;
}

async function resolveInviteByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("guild_invites")
    .select(
      "id, guild_id, email, default_role, expires_at, status, metadata, used_at, used_by_user_id, created_by_user_id",
    )
    .eq("email", email)
    .in("status", ["pending", "superseded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load invite by email", error);
    throw new ApiError(500, "Unable to load invite");
  }
  return data;
}

export async function acceptInviteWithToken(
  token: string,
  userId: string,
  actorEmail?: string,
): Promise<{ guildId: string; role: GuildRole }> {
  const tokenHash = hashToken(token);
  const invite = await resolveInviteByTokenHash(tokenHash);

  if (!invite) {
    throw new ApiError(404, "Invite token is invalid");
  }

  if (invite.status !== "pending") {
    throw new ApiError(400, "Invite is no longer valid");
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin
      .from("guild_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    throw new ApiError(400, "Invite has expired");
  }

  if (invite.email && actorEmail && invite.email.toLowerCase() !== actorEmail.toLowerCase()) {
    throw new ApiError(400, "Invite is bound to a different email address");
  }

  const role = invite.default_role as GuildRole;

  await assignGuildUserRole(invite.guild_id as string, userId, role, userId, {
    source: "invite", skipPermissionCheck: true,
  });

  const { error: updateError } = await supabaseAdmin
    .from("guild_invites")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
      used_by_user_id: userId,
    })
    .eq("id", invite.id);

  if (updateError) {
    console.error("Failed to mark invite as used", updateError);
  }

  await recordAuditLog(supabaseAdmin, {
    guildId: invite.guild_id as string,
    actorUserId: userId,
    targetUserId: userId,
    action: "INVITE_ACCEPTED",
    metadata: {
      invite_id: invite.id,
      via: "token",
    },
  });

  return { guildId: invite.guild_id as string, role };
}

export async function acceptInviteForEmail(
  email: string,
  userId: string,
): Promise<{ guildId: string; role: GuildRole } | null> {
  const invite = await resolveInviteByEmail(email);
  if (!invite) {
    return null;
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin
      .from("guild_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return null;
  }

  const metadata = (invite.metadata as Record<string, unknown>) ?? {};
  if (!metadata.auto_accept) {
    return null;
  }

  const role = invite.default_role as GuildRole;
  await assignGuildUserRole(invite.guild_id as string, userId, role, invite.created_by_user_id, {
    source: "manual",
  });

  const { error: updateError } = await supabaseAdmin
    .from("guild_invites")
    .update({
      status: "used",
      used_at: new Date().toISOString(),
      used_by_user_id: userId,
    })
    .eq("id", invite.id);

  if (updateError) {
    console.error("Failed to mark auto-accept invite as used", updateError);
  }

  await recordAuditLog(supabaseAdmin, {
    guildId: invite.guild_id as string,
    actorUserId: invite.created_by_user_id as string,
    targetUserId: userId,
    action: "INVITE_ACCEPTED",
    metadata: {
      invite_id: invite.id,
      via: "auto_accept",
      email,
    },
  });

  return { guildId: invite.guild_id as string, role };
}
