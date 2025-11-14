import { api } from "@/lib/api";
import type { LootDistribution, LootRecord, Rarity } from "@/lib/types";

export interface LootListResponse {
  loot: LootRecord[];
  total: number;
}

export interface LootListFilters {
  search?: string;
  status?: "distributed" | "pending";
  page?: number;
  pageSize?: number;
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

export async function listLoot(
  guildId: string,
  filters: LootListFilters = {},
): Promise<LootListResponse> {
  const { data } = await api.get<LootListResponse>(`/guilds/${guildId}/loot`, {
    params: filters,
  });
  return data;
}

export async function createLoot(
  guildId: string,
  payload: CreateLootPayload,
): Promise<LootRecord> {
  const { data } = await api.post<LootRecord>(`/guilds/${guildId}/loot`, payload);
  return data;
}

export async function updateLoot(
  guildId: string,
  lootId: string,
  payload: CreateLootPayload,
): Promise<LootRecord> {
  const { data } = await api.patch<LootRecord>(`/guilds/${guildId}/loot/${lootId}`, payload);
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

export async function deleteLoot(guildId: string, lootId: string): Promise<void> {
  await api.delete(`/guilds/${guildId}/loot/${lootId}`);
}
