import { api } from "@/lib/api";
import type { AdminGuildSummary } from "@/lib/types";

export interface AdminGuildPayload {
  name: string;
  tag: string;
  description?: string | null;
}

export async function listAdminGuilds(): Promise<AdminGuildSummary[]> {
  const { data } = await api.get<AdminGuildSummary[]>("/admin/guilds");
  return data;
}

export async function createAdminGuild(
  payload: AdminGuildPayload,
): Promise<AdminGuildSummary> {
  const { data } = await api.post<AdminGuildSummary>("/admin/guilds", payload);
  return data;
}

export async function updateAdminGuild(
  guildId: string,
  payload: AdminGuildPayload,
): Promise<AdminGuildSummary> {
  const { data } = await api.patch<AdminGuildSummary>(
    `/admin/guilds/${guildId}`,
    payload,
  );
  return data;
}

export async function deleteAdminGuild(guildId: string): Promise<void> {
  await api.delete(`/admin/guilds/${guildId}`);
}
