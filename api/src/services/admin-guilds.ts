import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { recordAuditLog } from "./audit.js";

export interface AdminGuildSummary {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  admin_count: number;
}

export interface GuildUpsertPayload {
  name: string;
  tag: string;
  description?: string | null;
}

type AdminGuildRow = {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number | null;
  admin_count?: number | null;
};

function mapAdminGuildRow(row: AdminGuildRow): AdminGuildSummary {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    member_count: Number(row.member_count ?? 0),
    admin_count: Number(row.admin_count ?? 0),
  };
}

function normalizePayload(payload: GuildUpsertPayload): GuildUpsertPayload {
  const description = payload.description?.trim();
  return {
    name: payload.name.trim(),
    tag: payload.tag.trim(),
    description: description?.length ? description : null,
  };
}

function isMissingRpc(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: string };
  return err.code === "PGRST202";
}

function isInvalidEnum(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as { code?: string };
  return err.code === "22P02";
}

async function fetchAdminGuildsDirect(guildId?: string): Promise<AdminGuildSummary[]> {
  let query = supabaseAdmin
    .from("guilds")
    .select("id, name, tag, description, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (guildId) {
    query = query.eq("id", guildId).limit(1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load admin guild overview", error);
    throw new ApiError(500, "Unable to load guilds");
  }

  const rows = (data as AdminGuildRow[] | null) ?? [];

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const [memberCountRes, adminCountRes] = await Promise.all([
        supabaseAdmin
          .from("members")
          .select("id", { head: true, count: "exact" })
          .eq("guild_id", row.id)
          .eq("is_active", true),
        supabaseAdmin
          .from("guild_user_roles")
          .select("id", { head: true, count: "exact" })
          .eq("guild_id", row.id)
          .eq("role", "guild_admin")
          .is("revoked_at", null),
      ]);

      if (memberCountRes.error) {
        console.warn("Failed to count guild members for admin view", memberCountRes.error);
      }
      if (adminCountRes.error) {
        console.warn("Failed to count guild admins for admin view", adminCountRes.error);
      }

      const member_count = memberCountRes.count ?? 0;
      const admin_count = adminCountRes.count ?? 0;

      return mapAdminGuildRow({
        ...row,
        member_count,
        admin_count,
      });
    }),
  );

  return enriched;
}

async function fetchAdminGuildViaRpc(guildId?: string): Promise<AdminGuildSummary[]> {
  const { data, error } = await supabaseAdmin.rpc("admin_list_guilds", {
    p_guild_id: guildId ?? null,
  });

  if (error) {
    if (isMissingRpc(error)) {
      return fetchAdminGuildsDirect(guildId);
    }
    console.error("Failed to load admin guild overview", error);
    throw new ApiError(500, "Unable to load guilds");
  }

  const rows = (data as AdminGuildRow[] | null) ?? [];
  return rows.map(mapAdminGuildRow);
}

export async function listAdminGuilds(): Promise<AdminGuildSummary[]> {
  return fetchAdminGuildViaRpc();
}

export async function getAdminGuild(guildId: string): Promise<AdminGuildSummary> {
  const guilds = await fetchAdminGuildViaRpc(guildId);
  const guild = guilds[0];
  if (!guild) {
    throw new ApiError(404, "Guild not found");
  }
  return guild;
}

export async function createAdminGuild(
  actorId: string,
  payload: GuildUpsertPayload,
): Promise<AdminGuildSummary> {
  const normalized = normalizePayload(payload);
  const { data, error } = await supabaseAdmin
    .from("guilds")
    .insert({
      name: normalized.name,
      tag: normalized.tag,
      description: normalized.description,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to create guild", error);
    throw new ApiError(500, "Unable to create guild");
  }

  const guildId = data.id as string;

  try {
    await recordAuditLog(supabaseAdmin, {
      guildId,
      actorUserId: actorId,
      action: "GUILD_CREATED",
      metadata: {
        guild_id: guildId,
        name: normalized.name,
        tag: normalized.tag,
      },
    });
  } catch (error) {
    if (isInvalidEnum(error)) {
      console.warn("Falling back to legacy audit action for guild creation");
      await recordAuditLog(supabaseAdmin, {
        guildId,
        actorUserId: actorId,
        action: "INVITE_CREATED",
        metadata: {
          fallback_action: "GUILD_CREATED",
          guild_id: guildId,
          name: normalized.name,
          tag: normalized.tag,
        },
      });
    } else {
      throw error;
    }
  }

  return getAdminGuild(guildId);
}

export async function updateAdminGuild(
  actorId: string,
  guildId: string,
  payload: GuildUpsertPayload,
): Promise<AdminGuildSummary> {
  const { data: existing, error: loadError } = await supabaseAdmin
    .from("guilds")
    .select("id, name, tag, description")
    .eq("id", guildId)
    .maybeSingle<{ id: string; name: string; tag: string; description: string | null }>();

  if (loadError) {
    console.error("Failed to load guild for update", loadError);
    throw new ApiError(500, "Unable to load guild");
  }
  if (!existing) {
    throw new ApiError(404, "Guild not found");
  }

  const normalized = normalizePayload(payload);

  const { error } = await supabaseAdmin
    .from("guilds")
    .update({
      name: normalized.name,
      tag: normalized.tag,
      description: normalized.description,
    })
    .eq("id", guildId);

  if (error) {
    console.error("Failed to update guild", error);
    throw new ApiError(500, "Unable to update guild");
  }

  const changes: Record<string, { previous: string | null; next: string | null }> = {};
  if (existing.name !== normalized.name) {
    changes.name = { previous: existing.name, next: normalized.name };
  }
  if (existing.tag !== normalized.tag) {
    changes.tag = { previous: existing.tag, next: normalized.tag };
  }
  if ((existing.description ?? null) !== normalized.description) {
    changes.description = {
      previous: existing.description ?? null,
      next: normalized.description ?? null,
    };
  }

  if (Object.keys(changes).length > 0) {
    try {
      await recordAuditLog(supabaseAdmin, {
        guildId,
        actorUserId: actorId,
        action: "GUILD_UPDATED",
        metadata: {
          guild_id: guildId,
          changes,
        },
      });
    } catch (error) {
      if (isInvalidEnum(error)) {
        console.warn("Falling back to legacy audit action for guild update");
        await recordAuditLog(supabaseAdmin, {
          guildId,
          actorUserId: actorId,
          action: "TRANSACTION_CONFIRMED",
          metadata: {
            fallback_action: "GUILD_UPDATED",
            guild_id: guildId,
            changes,
          },
        });
      } else {
        throw error;
      }
    }
  }

  return getAdminGuild(guildId);
}

export async function deleteAdminGuild(actorId: string, guildId: string): Promise<void> {
  const { data: existing, error: loadError } = await supabaseAdmin
    .from("guilds")
    .select("id, name, tag")
    .eq("id", guildId)
    .maybeSingle<{ id: string; name: string; tag: string }>();

  if (loadError) {
    console.error("Failed to load guild for deletion", loadError);
    throw new ApiError(500, "Unable to load guild");
  }
  if (!existing) {
    throw new ApiError(404, "Guild not found");
  }

  const { error } = await supabaseAdmin.from("guilds").delete().eq("id", guildId);

  if (error) {
    console.error("Failed to delete guild", error);
    throw new ApiError(500, "Unable to delete guild");
  }

  try {
    await recordAuditLog(supabaseAdmin, {
      guildId,
      actorUserId: actorId,
      action: "GUILD_DELETED",
      metadata: {
        guild_id: guildId,
        name: existing.name,
        tag: existing.tag,
      },
    });
  } catch (error) {
    if (isInvalidEnum(error)) {
      console.warn("Falling back to legacy audit action for guild deletion");
      await recordAuditLog(supabaseAdmin, {
        guildId,
        actorUserId: actorId,
        action: "INVITE_REVOKED",
        metadata: {
          fallback_action: "GUILD_DELETED",
          guild_id: guildId,
          name: existing.name,
          tag: existing.tag,
        },
      });
    } else {
      throw error;
    }
  }
}
