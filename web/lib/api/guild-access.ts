import { api } from "@/lib/api";
import type { GuildRoleAssignment, GuildRole } from "@/lib/types";

export async function fetchGuildAccess(guildId: string): Promise<GuildRoleAssignment[]> {
  const { data } = await api.get<GuildRoleAssignment[]>(`/guilds/${guildId}/access`);
  return data;
}

export interface CreateGuildAccessPayload {
  user_id?: string;
  email?: string;
  role: GuildRole;
}

export async function createGuildAccess(
  guildId: string,
  payload: CreateGuildAccessPayload,
): Promise<GuildRoleAssignment> {
  const { data } = await api.post<GuildRoleAssignment>(`/guilds/${guildId}/access`, payload);
  return data;
}

export async function updateGuildAccess(
  guildId: string,
  userId: string,
  role: GuildRole,
): Promise<GuildRoleAssignment> {
  const { data } = await api.patch<GuildRoleAssignment>(
    `/guilds/${guildId}/access/${userId}`,
    { role },
  );
  return data;
}
