
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { userIsSuperAdmin } from "./access.js";
import type { AuditAction, AuditLog, GuildRole } from "../types.js";

export interface AuditLogPayload {
  action: AuditAction;
  guildId?: string | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditLog(
  client: SupabaseClient,
  payload: AuditLogPayload,
): Promise<void> {
  const { error } = await client.from("audit_logs").insert({
    guild_id: payload.guildId ?? null,
    actor_user_id: payload.actorUserId ?? null,
    target_user_id: payload.targetUserId ?? null,
    action: payload.action,
    metadata: payload.metadata ?? {},
  });

  if (error) {
    console.error("Failed to record audit log", error);
  }
}

async function getActorGuildRole(guildId: string, userId: string): Promise<GuildRole | null> {
  if (await userIsSuperAdmin(userId)) {
    return "guild_admin";
  }

  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select("role")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve actor guild role", error);
    return null;
  }

  return (data?.role as GuildRole | undefined) ?? null;
}

export interface AuditLogQueryOptions {
  actions?: AuditAction[];
  limit?: number;
  cursor?: string;
}

export async function listGuildAuditLogs(
  guildId: string,
  actorId: string,
  options: AuditLogQueryOptions = {},
): Promise<AuditLog[]> {
  type AuditLogRow = {
    id: string;
    guild_id: string | null;
    actor_user_id: string | null;
    target_user_id: string | null;
    action: AuditAction;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor:
      | { display_name: string | null; email: string | null }
      | Array<{ display_name: string | null; email: string | null }>
      | null;
    target:
      | { display_name: string | null; email: string | null }
      | Array<{ display_name: string | null; email: string | null }>
      | null;
  };

  const actorRole = await getActorGuildRole(guildId, actorId);

  if (!actorRole) {
    throw new ApiError(403, "Forbidden");
  }

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  let query = supabaseAdmin
    .from("audit_logs")
    .select(
      "id, guild_id, actor_user_id, target_user_id, action, metadata, created_at, actor:profiles!audit_logs_actor_user_id_fkey(display_name,email), target:profiles!audit_logs_target_user_id_fkey(display_name,email)",
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.actions && options.actions.length > 0) {
    query = query.in("action", options.actions);
  }

  if (options.cursor) {
    query = query.lt("created_at", options.cursor);
  }

  if (actorRole === "guild_admin") {
    // full access
  } else if (actorRole === "officer") {
    query = query.in("action", [
      "ROLE_ASSIGNED",
      "ROLE_REVOKED",
      "INVITE_CREATED",
      "INVITE_REVOKED",
      "INVITE_ACCEPTED",
    ]);
  } else {
    // Raider & below: only self-related entries
    query = query.or(
      `actor_user_id.eq.${actorId},target_user_id.eq.${actorId}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load audit logs", error);
    throw new ApiError(500, "Unable to load audit logs");
  }

  const rows = (data ?? []) as AuditLogRow[];

  return rows.map((row) => {
    const actorProfile = Array.isArray(row.actor)
      ? row.actor?.[0] ?? null
      : row.actor ?? null;
    const targetProfile = Array.isArray(row.target)
      ? row.target?.[0] ?? null
      : row.target ?? null;

    return {
      id: row.id as string,
      guild_id: row.guild_id as string,
      actor_user_id: (row.actor_user_id as string | null | undefined) ?? null,
      actor_name:
        actorProfile?.display_name ?? actorProfile?.email ?? null,
      target_user_id: (row.target_user_id as string | null | undefined) ?? null,
      target_name:
        targetProfile?.display_name ?? targetProfile?.email ?? null,
      action: row.action as AuditAction,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: row.created_at as string,
    };
  });
}


