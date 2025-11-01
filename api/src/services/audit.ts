
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { userIsSuperAdmin } from "./access.js";
import type { AuditAction, AuditLog, GuildRole } from "../types.js";

const LEGACY_AUDIT_ACTIONS = new Set<AuditAction>([
  "ROLE_ASSIGNED",
  "ROLE_REVOKED",
  "INVITE_CREATED",
  "INVITE_REVOKED",
  "INVITE_ACCEPTED",
  "TRANSACTION_CONFIRMED",
]);

const AUDIT_ACTION_FALLBACK_MAP: Partial<Record<AuditAction, AuditAction>> = {
  GUILD_CREATED: "INVITE_CREATED",
  GUILD_UPDATED: "TRANSACTION_CONFIRMED",
  GUILD_DELETED: "INVITE_REVOKED",
  TRANSACTION_CREATED: "TRANSACTION_CONFIRMED",
  TRANSACTION_UPDATED: "TRANSACTION_CONFIRMED",
  TRANSACTION_DELETED: "TRANSACTION_CONFIRMED",
  LOOT_CREATED: "INVITE_ACCEPTED",
  LOOT_UPDATED: "INVITE_ACCEPTED",
  LOOT_DELETED: "INVITE_REVOKED",
  LOOT_DISTRIBUTED: "TRANSACTION_CONFIRMED",
};

function mapActionsToLegacy(actions?: AuditAction[]): AuditAction[] | undefined {
  if (!actions || actions.length === 0) {
    return undefined;
  }
  const mapped = new Set<AuditAction>();
  for (const action of actions) {
    if (LEGACY_AUDIT_ACTIONS.has(action)) {
      mapped.add(action);
      continue;
    }
    const fallback = AUDIT_ACTION_FALLBACK_MAP[action];
    if (fallback) {
      mapped.add(fallback);
    }
  }
  return mapped.size > 0 ? Array.from(mapped) : undefined;
}

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
  const insert = async (action: AuditAction, metadata: Record<string, unknown>) =>
    client.from("audit_logs").insert({
      guild_id: payload.guildId ?? null,
      actor_user_id: payload.actorUserId ?? null,
      target_user_id: payload.targetUserId ?? null,
      action,
      metadata,
    });

  const baseMetadata = payload.metadata ?? {};
  let { error } = await insert(payload.action, baseMetadata);

  if (error && error.code === "22P02") {
    const fallback = AUDIT_ACTION_FALLBACK_MAP[payload.action];
    if (fallback && fallback !== payload.action) {
      const metadataWithFallback = {
        ...baseMetadata,
        fallback_action: payload.action,
      };
      ({ error } = await insert(fallback, metadataWithFallback));
    }
  }

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
  const officerFullActions: AuditAction[] = [
    "ROLE_ASSIGNED",
    "ROLE_REVOKED",
    "INVITE_CREATED",
    "INVITE_REVOKED",
    "INVITE_ACCEPTED",
    "TRANSACTION_CREATED",
    "TRANSACTION_UPDATED",
    "TRANSACTION_DELETED",
    "TRANSACTION_CONFIRMED",
    "LOOT_CREATED",
    "LOOT_UPDATED",
    "LOOT_DELETED",
    "LOOT_DISTRIBUTED",
  ];
  const officerLegacyActions = mapActionsToLegacy(officerFullActions) ?? [];

  const buildQuery = (actionsToUse: AuditAction[] | undefined, useLegacy: boolean) => {
    let query = supabaseAdmin
      .from("audit_logs")
      .select(
        "id, guild_id, actor_user_id, target_user_id, action, metadata, created_at, actor:profiles!audit_logs_actor_user_id_fkey(display_name,email), target:profiles!audit_logs_target_user_id_fkey(display_name,email)",
      )
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (actionsToUse && actionsToUse.length > 0) {
      query = query.in("action", actionsToUse);
    }

    if (options.cursor) {
      query = query.lt("created_at", options.cursor);
    }

    if (actorRole === "guild_admin") {
      // full access
    } else if (actorRole === "officer") {
      const allowed = useLegacy ? officerLegacyActions : officerFullActions;
      const enforced =
        actionsToUse && actionsToUse.length > 0
          ? actionsToUse.filter((action) => allowed.includes(action))
          : allowed;
      if (enforced && enforced.length > 0) {
        query = query.in("action", enforced);
      }
    } else {
      // Raider & below: only self-related entries
      query = query.or(
        `actor_user_id.eq.${actorId},target_user_id.eq.${actorId}`,
      );
    }

    return query;
  };

  const initialActions =
    options.actions && options.actions.length > 0
      ? Array.from(new Set(options.actions))
      : undefined;

  let { data, error } = await buildQuery(initialActions, false);

  if (error && error.code === "22P02") {
    const fallbackActions = mapActionsToLegacy(initialActions);
    ({ data, error } = await buildQuery(fallbackActions, true));
  }

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


