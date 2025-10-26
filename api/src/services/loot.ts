import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type { LootDistribution, LootRecord } from "../types.js";
import { recordAuditLog } from "./audit.js";
import { requireGuildRole } from "./access.js";

export interface LootListResponse {
  loot: LootRecord[];
  total: number;
}

function mapLoot(row: Record<string, unknown>): LootRecord {
  return {
    id: row.id as string,
    guild_id: row.guild_id as string,
    created_at: row.created_at as string,
    boss_name: (row.boss_name as string) ?? "",
    item_name: (row.item_name as string) ?? "",
    item_rarity: row.item_rarity as LootRecord["item_rarity"],
    estimated_value: Number(row.estimated_value ?? 0),
    distributed: Boolean(row.distributed),
    distributed_at: (row.distributed_at as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
  };
}

export async function listLoot(guildId: string): Promise<LootListResponse> {
  const { data, error, count } = await supabaseAdmin
    .from("loot_records")
    .select(
      "id, guild_id, created_at, boss_name, item_name, item_rarity, estimated_value, distributed, distributed_at, notes",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load loot", error);
    throw new ApiError(500, "Unable to load loot records");
  }

  return {
    loot: (data ?? []).map(mapLoot),
    total: count ?? 0,
  };
}

export interface CreateLootPayload {
  boss_name: string;
  item_name: string;
  item_rarity: LootRecord["item_rarity"];
  estimated_value: number;
  notes?: string | null;
}

export async function createLoot(
  guildId: string,
  payload: CreateLootPayload,
): Promise<LootRecord> {
  const { data, error } = await supabaseAdmin
    .from("loot_records")
    .insert({
      guild_id: guildId,
      boss_name: payload.boss_name,
      item_name: payload.item_name,
      item_rarity: payload.item_rarity,
      estimated_value: payload.estimated_value,
      notes: payload.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create loot", error);
    throw new ApiError(500, "Unable to create loot record");
  }

  return mapLoot(data);
}

export interface DistributeLootPayload {
  lootId: string;
  distributions: LootDistribution[];
}

export async function distributeLoot(
  guildId: string,
  userId: string,
  payload: DistributeLootPayload,
): Promise<LootRecord> {
  if (!payload.distributions.length) {
    throw new ApiError(400, "validation error", {
      distributions: "must include at least one entry",
    });
  }

  const memberIds = new Set<string>();
  let totalShare = 0;
  for (const item of payload.distributions) {
    if (memberIds.has(item.member_id)) {
      throw new ApiError(400, "validation error", {
        member_id: "duplicate member in distribution payload",
      });
    }
    memberIds.add(item.member_id);
    if (item.share_amount < 0) {
      throw new ApiError(400, "validation error", {
        share_amount: "must be a non-negative number",
      });
    }
    totalShare += item.share_amount;
  }

  const { data: loot, error: lootError } = await supabaseAdmin
    .from("loot_records")
    .select("id, guild_id, estimated_value, distributed, item_name")
    .eq("id", payload.lootId)
    .maybeSingle();

  if (lootError) {
    console.error("Failed to load loot record", lootError);
    throw new ApiError(500, "Unable to load loot record");
  }

  if (!loot || loot.guild_id !== guildId) {
    throw new ApiError(404, "Loot record not found");
  }

  if (loot.distributed) {
    throw new ApiError(400, "Loot already distributed");
  }

  if (totalShare > Number(loot.estimated_value ?? 0) + 0.0001) {
    throw new ApiError(400, "validation error", {
      share_amount: "total share exceeds estimated value",
    });
  }

  await requireGuildRole(supabaseAdmin, userId, guildId, ["guild_admin", "officer", "raider"]);

  const { data: members, error: membersError } = await supabaseAdmin
    .from("members")
    .select("id, guild_id, in_game_name")
    .in("id", Array.from(memberIds));

  if (membersError) {
    console.error("Failed to load members for loot distribution", membersError);
    throw new ApiError(500, "Unable to load members");
  }

  if ((members?.length ?? 0) !== memberIds.size) {
    throw new ApiError(400, "validation error", {
      member_id: "one or more members do not exist",
    });
  }

  for (const member of members ?? []) {
    if (member.guild_id !== guildId) {
      throw new ApiError(400, "validation error", {
        member_id: "member does not belong to this guild",
      });
    }
  }

  const memberNameById = new Map<string, string>();
  members?.forEach((m) => memberNameById.set(m.id, m.in_game_name));

  const { error: deleteError } = await supabaseAdmin
    .from("loot_distribution")
    .delete()
    .eq("loot_id", payload.lootId);

  if (deleteError) {
    console.error("Failed to reset loot distribution", deleteError);
    throw new ApiError(500, "Unable to reset distribution");
  }

  const insertPayload = payload.distributions.map((entry) => ({
    loot_id: payload.lootId,
    member_id: entry.member_id,
    share_amount: entry.share_amount,
  }));

  const { error: insertError } = await supabaseAdmin
    .from("loot_distribution")
    .insert(insertPayload);

  if (insertError) {
    console.error("Failed to insert loot distribution", insertError);
    throw new ApiError(500, "Unable to persist distribution");
  }

  const nowIso = new Date().toISOString();
  const { error: updateLootError } = await supabaseAdmin
    .from("loot_records")
    .update({ distributed: true, distributed_at: nowIso })
    .eq("id", payload.lootId);

  if (updateLootError) {
    console.error("Failed to mark loot as distributed", updateLootError);
    throw new ApiError(500, "Unable to update loot record");
  }

  if (payload.distributions.length > 0) {
    const txPayload = payload.distributions.map((entry) => ({
      guild_id: guildId,
      created_by: userId,
      tx_type: "expense",
      category: "loot_distribution",
      amount: entry.share_amount,
      description: `Loot distribution for ${loot.item_name} -> ${
        memberNameById.get(entry.member_id) ?? entry.member_id
      }`,
      confirmed: false,
    }));

    const { error: txError } = await supabaseAdmin.from("transactions").insert(txPayload);
    if (txError) {
      console.error("Failed to create transactions for loot distribution", txError);
    }
  }

  await recordAuditLog(supabaseAdmin, {
    guildId,
    actorUserId: userId,
    action: "LOOT_DISTRIBUTED",
    metadata: {
      loot_id: payload.lootId,
      item_name: loot.item_name,
      total_share: totalShare,
      distributions: payload.distributions.map((entry) => ({
        member_id: entry.member_id,
        share_amount: entry.share_amount,
        member_name: memberNameById.get(entry.member_id),
      })),
    },
  });

  const { data: updatedLoot, error: fetchError } = await supabaseAdmin
    .from("loot_records")
    .select(
      "id, guild_id, created_at, boss_name, item_name, item_rarity, estimated_value, distributed, distributed_at, notes",
    )
    .eq("id", payload.lootId)
    .maybeSingle();

  if (fetchError || !updatedLoot) {
    console.error("Failed to fetch updated loot record", fetchError);
    throw new ApiError(500, "Unable to fetch updated loot record");
  }

  return mapLoot(updatedLoot);
}
