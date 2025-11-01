import { api } from "@/lib/api";
import type { AdminUserSummary, GuildRole } from "@/lib/types";

export interface AssignUserPayload {
  guild_id: string;
  role: GuildRole;
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const { data } = await api.get<AdminUserSummary[]>("/admin/users");
  return data;
}

export async function assignUserToGuild(
  userId: string,
  payload: AssignUserPayload,
): Promise<void> {
  await api.post(`/admin/users/${userId}/guilds`, payload);
}

export async function removeUserFromGuild(userId: string, guildId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}/guilds/${guildId}`);
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}`);
}
