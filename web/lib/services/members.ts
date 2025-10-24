import { supabase } from "@/lib/supabase-client";
import type { Member, MemberRole } from "@/lib/types";

export interface MemberListResponse {
  members: Member[];
  total: number;
}

export interface MemberFilters {
  search?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export async function fetchMembers(
  guildId: string,
  filters: MemberFilters = {},
): Promise<MemberListResponse> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
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
    throw error;
  }

  return {
    members:
      data?.map(
        (member): Member => ({
          id: member.id,
          guild_id: member.guild_id,
          user_id: member.user_id,
          in_game_name: member.in_game_name,
          role_in_guild: member.role_in_guild,
          join_date: member.join_date ?? undefined,
          contact: (member.contact as Record<string, unknown> | null) ?? undefined,
          notes: member.notes ?? undefined,
          is_active: member.is_active,
          created_at: member.created_at,
          updated_at: member.updated_at,
        }),
      ) ?? [],
    total: count ?? 0,
  };
}

export interface UpsertMemberInput {
  in_game_name: string;
  role_in_guild: MemberRole;
  join_date?: string | null;
  notes?: string | null;
  contact?: Record<string, string | undefined>;
  is_active?: boolean;
}

export async function createMember(guildId: string, payload: UpsertMemberInput) {
  const { data, error } = await supabase
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
    throw error;
  }

  return {
    ...data,
    notes: data.notes ?? undefined,
    contact: (data.contact as Record<string, unknown> | null) ?? undefined,
  } as Member;
}

export async function updateMember(
  guildId: string,
  memberId: string,
  payload: UpsertMemberInput,
) {
  const { data, error } = await supabase
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
    throw error;
  }

  return {
    ...data,
    notes: data.notes ?? undefined,
    contact: (data.contact as Record<string, unknown> | null) ?? undefined,
  } as Member;
}

export async function toggleMemberActive(
  guildId: string,
  memberId: string,
  isActive: boolean,
) {
  const { data, error } = await supabase
    .from("members")
    .update({ is_active: isActive })
    .eq("guild_id", guildId)
    .eq("id", memberId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    notes: data.notes ?? undefined,
    contact: (data.contact as Record<string, unknown> | null) ?? undefined,
  } as Member;
}
