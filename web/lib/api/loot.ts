import { api } from "@/lib/api";
import type { LootDistribution, LootRecord, Rarity } from "@/lib/types";

export interface LootListResponse {
  loot: LootRecord[];
  total: number;
}

export interface CreateLootPayload {
  boss_name: string;
  item_name: string;
  item_rarity: Rarity;
  estimated_value: number;
  notes?: string;
}

export interface DistributeLootPayload {
  loot_id: string;
  distributions: LootDistribution[];
}

export async function listLoot(guildId: string): Promise<LootListResponse> {
  const { data } = await api.get<LootListResponse>(`/guilds/${guildId}/loot`);
  return data;
}

export async function createLoot(
  guildId: string,
  payload: CreateLootPayload,
): Promise<LootRecord> {
  const { data } = await api.post<LootRecord>(`/guilds/${guildId}/loot`, payload);
  return data;
}

export async function distributeLoot(
  guildId: string,
  payload: DistributeLootPayload,
): Promise<LootRecord> {
  const { data } = await api.post<LootRecord>(
    `/guilds/${guildId}/loot/${payload.loot_id}/distribute`,
    payload,
  );
  return data;
}
