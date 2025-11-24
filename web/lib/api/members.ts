import { api } from "@/lib/api";
import type { Member, MemberRole } from "@/lib/types";

export interface MemberListParams {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MemberListResponse {
  members: Member[];
  total: number;
}

export interface UpsertMemberPayload {
  in_game_name: string;
  role_in_guild: Member["role_in_guild"];
  class?: string | null;
  combat_power?: number | null;
  join_date?: string | null;
  notes?: string | null;
  contact?: Record<string, string | null | undefined>;
  is_active?: boolean;
}

export async function listMembers(
  guildId: string,
  params: MemberListParams = {},
): Promise<MemberListResponse> {
  const { data } = await api.get<MemberListResponse>(`/guilds/${guildId}/members`, {
    params: {
      ...params,
      active: params.active === undefined ? undefined : String(params.active),
    },
  });
  return data;
}

export async function createMember(
  guildId: string,
  payload: UpsertMemberPayload,
): Promise<Member> {
  const { data } = await api.post<Member>(`/guilds/${guildId}/members`, payload);
  return data;
}

export async function updateMember(
  guildId: string,
  memberId: string,
  payload: UpsertMemberPayload,
): Promise<Member> {
  const { data } = await api.put<Member>(`/guilds/${guildId}/members/${memberId}`, payload);
  return data;
}

export async function toggleMemberStatus(
  guildId: string,
  memberId: string,
  isActive: boolean,
): Promise<Member> {
  const { data } = await api.patch<Member>(
    `/guilds/${guildId}/members/${memberId}/status`,
    { is_active: isActive },
  );
  return data;
}

export async function deleteMember(guildId: string, memberId: string): Promise<void> {
  await api.delete(`/guilds/${guildId}/members/${memberId}`);
}
