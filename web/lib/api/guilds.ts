import { api } from "@/lib/api";
import type { DashboardResponse, GuildSummary } from "@/lib/types";

export async function fetchGuilds(): Promise<GuildSummary[]> {
  const { data } = await api.get<GuildSummary[]>("/guilds");
  return data;
}

export async function fetchDashboard(guildId?: string): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>("/dashboard", {
    params: guildId ? { guildId } : undefined,
  });
  return data;
}
