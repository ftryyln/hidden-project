import { supabase } from "@/lib/supabase-client";
import type { LootDistribution, LootRecord } from "@/lib/types";

export interface LootListResponse {
  loot: LootRecord[];
  total: number;
}

export async function fetchLoot(guildId: string): Promise<LootListResponse> {
  const { data, error, count } = await supabase
    .from("loot_records")
    .select(
      "id, guild_id, created_at, boss_name, item_name, item_rarity, estimated_value, distributed, distributed_at, notes",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return {
    loot:
      data?.map(
        (row): LootRecord => ({
          id: row.id,
          guild_id: row.guild_id,
          created_at: row.created_at,
          boss_name: row.boss_name ?? "",
          item_name: row.item_name ?? "",
          item_rarity: row.item_rarity,
          estimated_value: Number(row.estimated_value ?? 0),
          distributed: row.distributed,
          distributed_at: row.distributed_at ?? undefined,
          notes: row.notes ?? undefined,
        }),
      ) ?? [],
    total: count ?? 0,
  };
}

export interface CreateLootInput {
  boss_name: string;
  item_name: string;
  item_rarity: LootRecord["item_rarity"];
  estimated_value: number;
  notes?: string;
}

export async function createLoot(guildId: string, payload: CreateLootInput) {
  const { data, error } = await supabase
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
    throw error;
  }

  return {
    ...data,
    estimated_value: Number(data.estimated_value ?? 0),
    notes: data.notes ?? undefined,
  } as LootRecord;
}

export interface DistributeLootInput {
  loot_id: string;
  distributions: LootDistribution[];
}

export async function distributeLoot(guildId: string, payload: DistributeLootInput) {
  const { data, error } = await supabase.functions.invoke("distribute_loot", {
    body: {
      loot_id: payload.loot_id,
      distributions: payload.distributions,
      create_transactions: true,
    },
  });

  if (error) {
    throw error;
  }

  const { data: updatedLoot, error: fetchError } = await supabase
    .from("loot_records")
    .select("*")
    .eq("guild_id", guildId)
    .eq("id", payload.loot_id)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  return {
    ...updatedLoot,
    estimated_value: Number(updatedLoot.estimated_value ?? 0),
    notes: updatedLoot.notes ?? undefined,
  } as LootRecord;
}
