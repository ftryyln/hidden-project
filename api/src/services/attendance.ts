import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type {
  AttendanceActivityRecord,
  AttendanceEntryRecord,
  AttendanceSessionRecord,
} from "../types.js";
import { getRange } from "../utils/pagination.js";

export interface AttendanceMemberInput {
  memberId: string;
  note?: string | null;
  lootTag?: string | null;
}

export interface CreateAttendancePayload {
  bossName?: string | null;
  mapName?: string | null;
  startedAt: string;
  attendees: AttendanceMemberInput[];
  userId: string;
}

export interface AttendanceListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  bossName?: string;
  mapName?: string;
  from?: string;
  to?: string;
}

export interface AttendanceSessionSummary {
  id: string;
  bossName?: string | null;
  mapName?: string | null;
  startedAt: string;
  attendeesCount: number;
  createdBy: string;
  createdByName?: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface AttendanceListResponse {
  items: AttendanceSessionSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AttendanceDetail {
  session: AttendanceSessionSummary;
  entries: AttendanceEntryRecord[];
}

function extractDisplayName(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object") {
      return (first as { display_name?: string | null }).display_name ?? null;
    }
    return null;
  }
  if (typeof value === "object") {
    return (value as { display_name?: string | null }).display_name ?? null;
  }
  return null;
}

function mapSession(row: Record<string, any>): AttendanceSessionSummary {
  const attendanceRow = row as AttendanceSessionRecord & {
    creator?: { display_name?: string | null };
    attendance_entries?: Array<{ count: number }>;
  };
  const countCandidates = attendanceRow.attendance_entries ?? [];
  const attendeesCount =
    countCandidates.length > 0 && typeof countCandidates[0].count === "number"
      ? Number(countCandidates[0].count)
      : Number((row as any).attendees_count ?? 0);
  return {
    id: attendanceRow.id,
    bossName: attendanceRow.boss_name ?? null,
    mapName: attendanceRow.map_name ?? null,
    startedAt: attendanceRow.started_at,
    attendeesCount,
    createdBy: attendanceRow.created_by,
    createdByName: extractDisplayName(row.creator),
    updatedBy: attendanceRow.updated_by,
    updatedAt: attendanceRow.updated_at,
  };
}

function mapEntry(row: Record<string, any>): AttendanceEntryRecord {
  return {
    id: row.id as string,
    session_id: row.session_id as string,
    member_id: row.member_id as string,
    note: (row.note as string | null) ?? null,
    loot_tag: (row.loot_tag as string | null) ?? null,
    created_by: row.created_by as string,
    updated_by: row.updated_by as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    member_name: row.member?.in_game_name ?? null,
  };
}

async function recordActivity(
  sessionId: string,
  action: AttendanceActivityRecord["action"],
  performedBy: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from("attendance_activity").insert({
    session_id: sessionId,
    action,
    details: details ?? null,
    performed_by: performedBy,
  });
  if (error) {
    console.error("Failed to record attendance activity", error);
  }
}

export async function listAttendanceSessions(
  guildId: string,
  filters: AttendanceListFilters,
): Promise<AttendanceListResponse> {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(filters.pageSize ?? 10, 100);
  const { from, to } = getRange(page, pageSize);

  let query = supabaseAdmin
    .from("attendance_sessions")
    .select(
      "*, attendance_entries(count), creator:profiles!attendance_sessions_created_by_fkey(display_name)",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("started_at", { ascending: false })
    .range(from, to);

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    query = query.or(`boss_name.ilike.${pattern},map_name.ilike.${pattern}`);
  }
  if (filters.bossName) {
    query = query.ilike("boss_name", `%${filters.bossName}%`);
  }
  if (filters.mapName) {
    query = query.ilike("map_name", `%${filters.mapName}%`);
  }
  if (filters.from) {
    query = query.gte("started_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("started_at", filters.to);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("Failed to list attendance sessions", error);
    throw new ApiError(500, "Unable to load attendance");
  }

  const items = (data ?? []).map(mapSession);
  const total = count ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

async function fetchSessionOrThrow(guildId: string, sessionId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from("attendance_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load attendance session", error);
    throw new ApiError(500, "Unable to load attendance session");
  }
  if (!data || data.guild_id !== guildId) {
    throw new ApiError(404, "Attendance session not found");
  }
  return data;
}

export async function getAttendanceDetail(
  guildId: string,
  sessionId: string,
): Promise<AttendanceDetail> {
  const sessionRow = await fetchSessionOrThrow(guildId, sessionId);
  const { data: entryRows, error: entriesError } = await supabaseAdmin
    .from("attendance_entries")
    .select(
      "id, session_id, member_id, note, loot_tag, created_at, updated_at, created_by, updated_by, member:members!attendance_entries_member_id_fkey(in_game_name)",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (entriesError) {
    console.error("Failed to load attendance entries", entriesError);
    throw new ApiError(500, "Unable to load attendance session");
  }

  const sessionSummary = mapSession({
    ...sessionRow,
    attendance_entries: [{ count: entryRows?.length ?? 0 }],
  });

  return {
    session: sessionSummary,
    entries: (entryRows ?? []).map(mapEntry),
  };
}

export async function createAttendanceSession(
  guildId: string,
  payload: CreateAttendancePayload,
): Promise<AttendanceDetail> {
  if (!payload.bossName && !payload.mapName) {
    throw new ApiError(400, "Boss or map is required");
  }

  const { data: sessionRow, error } = await supabaseAdmin
    .from("attendance_sessions")
    .insert({
      guild_id: guildId,
      boss_name: payload.bossName ?? null,
      map_name: payload.mapName ?? null,
      started_at: payload.startedAt,
      created_by: payload.userId,
      updated_by: payload.userId,
    })
    .select("*")
    .single();

  if (error || !sessionRow) {
    console.error("Failed to create attendance session", error);
    throw new ApiError(500, "Unable to create attendance session");
  }

  if (payload.attendees.length > 0) {
    const { error: entriesError } = await supabaseAdmin.from("attendance_entries").insert(
      payload.attendees.map((attendee) => ({
        session_id: sessionRow.id,
        member_id: attendee.memberId,
        note: attendee.note ?? null,
        loot_tag: attendee.lootTag ?? null,
        created_by: payload.userId,
        updated_by: payload.userId,
      })),
    );
    if (entriesError) {
      console.error("Failed to insert attendance entries", entriesError);
      throw new ApiError(500, "Unable to create attendance session");
    }
  }

  await recordActivity(sessionRow.id, "CREATED", payload.userId, {
    bossName: payload.bossName ?? null,
    mapName: payload.mapName ?? null,
  });

  return getAttendanceDetail(guildId, sessionRow.id);
}

export async function updateAttendanceSession(
  guildId: string,
  sessionId: string,
  payload: CreateAttendancePayload,
): Promise<AttendanceDetail> {
  if (!payload.bossName && !payload.mapName) {
    throw new ApiError(400, "Boss or map is required");
  }

  const sessionRow = await fetchSessionOrThrow(guildId, sessionId);

  const { error: updateError } = await supabaseAdmin
    .from("attendance_sessions")
    .update({
      boss_name: payload.bossName ?? null,
      map_name: payload.mapName ?? null,
      started_at: payload.startedAt,
      updated_by: payload.userId,
    })
    .eq("id", sessionId);

  if (updateError) {
    console.error("Failed to update attendance session", updateError);
    throw new ApiError(500, "Unable to update attendance session");
  }

  const { data: existingEntries, error: entriesError } = await supabaseAdmin
    .from("attendance_entries")
    .select("id, member_id")
    .eq("session_id", sessionId);

  if (entriesError) {
    console.error("Failed to load existing entries", entriesError);
    throw new ApiError(500, "Unable to update attendance session");
  }

  const existingMap = new Map<string, string>();
  (existingEntries ?? []).forEach((entry) => {
    existingMap.set(entry.member_id as string, entry.id as string);
  });

  const desiredSet = new Set(payload.attendees.map((attendee) => attendee.memberId));
  const toInsert = payload.attendees.filter(
    (attendee) => !existingMap.has(attendee.memberId),
  );
  const toKeep = payload.attendees.filter((attendee) =>
    existingMap.has(attendee.memberId),
  );
  const toRemove = Array.from(existingMap.keys()).filter((memberId) => !desiredSet.has(memberId));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("attendance_entries").insert(
      toInsert.map((attendee) => ({
        session_id: sessionId,
        member_id: attendee.memberId,
        note: attendee.note ?? null,
        loot_tag: attendee.lootTag ?? null,
        created_by: payload.userId,
        updated_by: payload.userId,
      })),
    );
    if (insertError) {
      console.error("Failed to insert new attendance entries", insertError);
      throw new ApiError(500, "Unable to update attendance session");
    }
  }

  if (toRemove.length > 0) {
    const entryIds = toRemove
      .map((memberId) => existingMap.get(memberId))
      .filter((id): id is string => Boolean(id));
    if (entryIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("attendance_entries")
        .delete()
        .in("id", entryIds);
      if (deleteError) {
        console.error("Failed to delete attendance entries", deleteError);
        throw new ApiError(500, "Unable to update attendance session");
      }
    }
  }

  if (toKeep.length > 0) {
    await Promise.all(
      toKeep.map((attendee) => {
        const entryId = existingMap.get(attendee.memberId);
        if (!entryId) return null;
        return supabaseAdmin
          .from("attendance_entries")
          .update({
            note: attendee.note ?? null,
            loot_tag: attendee.lootTag ?? null,
            updated_by: payload.userId,
          })
          .eq("id", entryId);
      }),
    );
  }

  await recordActivity(sessionId, "UPDATED", payload.userId, {
    bossName: payload.bossName ?? null,
    mapName: payload.mapName ?? null,
  });
  if (toInsert.length > 0) {
    await recordActivity(sessionId, "MEMBER_ADDED", payload.userId, {
      count: toInsert.length,
    });
  }
  if (toRemove.length > 0) {
    await recordActivity(sessionId, "MEMBER_REMOVED", payload.userId, {
      count: toRemove.length,
    });
  }

  return getAttendanceDetail(guildId, sessionId);
}

export async function deleteAttendanceSession(
  guildId: string,
  sessionId: string,
  userId: string,
): Promise<void> {
  await fetchSessionOrThrow(guildId, sessionId);
  const { error } = await supabaseAdmin
    .from("attendance_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) {
    console.error("Failed to delete attendance session", error);
    throw new ApiError(500, "Unable to delete attendance session");
  }
  await recordActivity(sessionId, "DELETED", userId, {});
}

export async function listAttendanceHistory(
  guildId: string,
  sessionId: string,
): Promise<AttendanceActivityRecord[]> {
  await fetchSessionOrThrow(guildId, sessionId);
  const { data, error } = await supabaseAdmin
    .from("attendance_activity")
    .select("id, session_id, action, details, performed_by, performed_at, performer:profiles!attendance_activity_performed_by_fkey(display_name)")
    .eq("session_id", sessionId)
    .order("performed_at", { ascending: false });
  if (error) {
    console.error("Failed to load attendance history", error);
    throw new ApiError(500, "Unable to load attendance history");
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    session_id: row.session_id as string,
    action: row.action as AttendanceActivityRecord["action"],
    details: (row.details as Record<string, unknown> | null) ?? null,
    performed_by: row.performed_by as string,
    performed_at: row.performed_at as string,
    performer_name: extractDisplayName(row.performer ?? null),
  }));
}
