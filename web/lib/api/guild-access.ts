
import { api } from "@/lib/api";
import type {
  GuildRoleAssignment,
  GuildRole,
  GuildInvite,
  AuditLog,
  AuditAction,
} from "@/lib/types";

export async function fetchGuildAccess(guildId: string): Promise<GuildRoleAssignment[]> {
  const { data } = await api.get<GuildRoleAssignment[]>(`/guilds/${guildId}/access`);
  return data;
}

export interface CreateGuildAccessPayload {
  user_id?: string;
  email?: string;
  role: GuildRole;
}

export type CreateGuildAccessResponse =
  | { type: "assignment"; assignment: GuildRoleAssignment }
  | { type: "invite"; invite: GuildInvite };

export async function createGuildAccess(
  guildId: string,
  payload: CreateGuildAccessPayload,
): Promise<CreateGuildAccessResponse> {
  const { data } = await api.post<CreateGuildAccessResponse>(`/guilds/${guildId}/access`, payload);
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

export async function revokeGuildAccess(guildId: string, userId: string): Promise<void> {
  await api.delete(`/guilds/${guildId}/access/${userId}`);
}

export async function fetchGuildInvites(guildId: string): Promise<GuildInvite[]> {
  const { data } = await api.get<GuildInvite[]>(`/guilds/${guildId}/invites`);
  return data;
}

export interface CreateGuildInvitePayload {
  email?: string;
  default_role: GuildRole;
  expires_at?: string;
}

export async function createGuildInvite(
  guildId: string,
  payload: CreateGuildInvitePayload,
): Promise<GuildInvite> {
  const { data } = await api.post<GuildInvite>(`/guilds/${guildId}/invites`, payload);
  return data;
}

export async function revokeGuildInvite(
  guildId: string,
  inviteId: string,
): Promise<void> {
  await api.post(`/guilds/${guildId}/invites/${inviteId}/revoke`);
}

export interface AuditLogQuery {
  actions?: AuditAction[];
  cursor?: string;
  limit?: number;
}

function buildAuditQuery(params: AuditLogQuery): string {
  const query = new URLSearchParams();
  if (params.actions && params.actions.length > 0) {
    query.set("actions", params.actions.join(","));
  }
  if (params.cursor) {
    query.set("cursor", params.cursor);
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchGuildAuditLogs(
  guildId: string,
  params: AuditLogQuery = {},
): Promise<AuditLog[]> {
  const qs = buildAuditQuery(params);
  const { data } = await api.get<AuditLog[]>(`/guilds/${guildId}/audit-logs${qs}`);
  return data;
}
