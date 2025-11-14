import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type { Member } from "../types.js";
import { getRange } from "../utils/pagination.js";

export interface MemberFilters {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MemberListResponse {
  members: Member[];
  total: number;
}

function mapMember(row: Record<string, unknown>): Member {
  return {
    id: row.id as string,
    guild_id: row.guild_id as string,
    user_id: (row.user_id as string | null) ?? undefined,
    in_game_name: (row.in_game_name as string) ?? "",
    role_in_guild: row.role_in_guild as Member["role_in_guild"],
    join_date: (row.join_date as string | null) ?? undefined,
    contact: (row.contact as Record<string, unknown> | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export async function listMembers(
  guildId: string,
  filters: MemberFilters,
): Promise<MemberListResponse> {
  const { from, to } = getRange(filters.page ?? 1, filters.pageSize ?? 25);

  let query = supabaseAdmin
    .from("members")
    .select(
      "id, guild_id, user_id, in_game_name, role_in_guild, join_date, contact, notes, is_active, created_at, updated_at",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("in_game_name", { ascending: true })
    .range(from, to);

  if (filters.active !== undefined) {
    query = query.eq("is_active", filters.active);
  }

  if (filters.search) {
    query = query.ilike("in_game_name", `%${filters.search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to load members", error);
    throw new ApiError(500, "Unable to load members");
  }

  return {
    members: (data ?? []).map(mapMember),
    total: count ?? 0,
  };
}

export interface MemberUpsertPayload {
  in_game_name: string;
  role_in_guild: Member["role_in_guild"];
  join_date?: string | null;
  notes?: string | null;
  contact?: Record<string, string | null | undefined>;
  is_active?: boolean;
}

export async function createMember(
  guildId: string,
  payload: MemberUpsertPayload,
): Promise<Member> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .insert({
      guild_id: guildId,
      in_game_name: payload.in_game_name,
      role_in_guild: payload.role_in_guild,
      join_date: payload.join_date ?? null,
      notes: payload.notes ?? null,
      contact: payload.contact ?? {},
      is_active: payload.is_active ?? true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create member", error);
    throw new ApiError(500, "Unable to create member");
  }

  return mapMember(data);
}

export async function updateMember(
  guildId: string,
  memberId: string,
  payload: MemberUpsertPayload,
): Promise<Member> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .update({
      in_game_name: payload.in_game_name,
      role_in_guild: payload.role_in_guild,
      join_date: payload.join_date ?? null,
      notes: payload.notes ?? null,
      contact: payload.contact ?? {},
      is_active: payload.is_active ?? true,
    })
    .eq("guild_id", guildId)
    .eq("id", memberId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update member", error);
    throw new ApiError(500, "Unable to update member");
  }

  return mapMember(data);
}

export async function toggleMemberActive(
  guildId: string,
  memberId: string,
  isActive: boolean,
): Promise<Member> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .update({ is_active: isActive })
    .eq("guild_id", guildId)
    .eq("id", memberId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to toggle member status", error);
    throw new ApiError(500, "Unable to update member status");
  }

  return mapMember(data);
}

export async function deleteMember(guildId: string, memberId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("members")
    .delete()
    .eq("guild_id", guildId)
    .eq("id", memberId);
  if (error) {
    console.error("Failed to delete member", error);
    throw new ApiError(500, "Unable to delete member");
  }
}
