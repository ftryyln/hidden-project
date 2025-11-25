import { apiClient, type ApiClientOptions } from "@/lib/apiClient";
import type {
  AttendanceDetail,
  AttendanceHistoryItem,
  AttendanceSessionSummary,
} from "@/lib/types";

interface ApiEnvelope<T> {
  data: T;
  error: { code: number; message: string } | null;
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.error) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

export interface AttendanceListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  bossName?: string;
  mapName?: string;
  from?: string;
  to?: string;
}

export interface AttendanceMemberInput {
  memberId: string;
  note?: string | null;
  lootTag?: string | null;
}

export interface AttendancePayload {
  bossName?: string | null;
  mapName?: string | null;
  startedAt: string;
  attendees: AttendanceMemberInput[];
}

export async function fetchAttendanceSessions(
  guildId: string,
  params: AttendanceListParams,
): Promise<{
  items: AttendanceSessionSummary[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}> {
  const query: ApiClientOptions["query"] = {
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    bossName: params.bossName,
    mapName: params.mapName,
    from: params.from,
    to: params.to,
  };

  const payload = await apiClient<ApiEnvelope<AttendanceSessionSummary[]>>(
    `/guilds/${guildId}/attendance`,
    { query },
  );

  return {
    items: unwrap(payload),
    meta: payload.meta ?? {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      totalItems: payload.data.length,
      totalPages: 1,
    },
  };
}

export async function createAttendanceSession(
  guildId: string,
  body: AttendancePayload,
): Promise<AttendanceDetail> {
  const payload = await apiClient<ApiEnvelope<AttendanceDetail>>(
    `/guilds/${guildId}/attendance`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return unwrap(payload);
}

export async function updateAttendanceSession(
  guildId: string,
  sessionId: string,
  body: AttendancePayload,
): Promise<AttendanceDetail> {
  const payload = await apiClient<ApiEnvelope<AttendanceDetail>>(
    `/guilds/${guildId}/attendance/${sessionId}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
  return unwrap(payload);
}

export async function deleteAttendanceSession(
  guildId: string,
  sessionId: string,
): Promise<void> {
  await apiClient<void>(`/guilds/${guildId}/attendance/${sessionId}`, {
    method: "DELETE",
  });
}

export async function fetchAttendanceDetail(
  guildId: string,
  sessionId: string,
): Promise<AttendanceDetail> {
  const payload = await apiClient<ApiEnvelope<AttendanceDetail>>(
    `/guilds/${guildId}/attendance/${sessionId}`,
  );
  return unwrap(payload);
}

export async function fetchAttendanceHistory(
  guildId: string,
  sessionId: string,
): Promise<AttendanceHistoryItem[]> {
  const payload = await apiClient<ApiEnvelope<AttendanceHistoryItem[]>>(
    `/guilds/${guildId}/attendance/${sessionId}/history`,
  );
  return unwrap(payload);
}

// New functions for Discord bot integration

export interface PendingAttendanceEntry {
  entryId: string;
  sessionId: string;
  memberId: string;
  memberName: string;
  discordUsername?: string;
  bossName?: string;
  mapName?: string;
  sessionName: string;
  startedAt: string;
  createdAt: string;
  note?: string;
  lootTag?: string;
}

export async function fetchPendingAttendance(
  guildId: string,
): Promise<PendingAttendanceEntry[]> {
  const payload = await apiClient<ApiEnvelope<PendingAttendanceEntry[]>>(
    `/guilds/${guildId}/attendance/pending`,
  );
  return unwrap(payload);
}

export async function confirmAttendanceEntry(
  guildId: string,
  entryId: string,
): Promise<{ id: string; confirmed: boolean; confirmedBy: string; confirmedAt: string }> {
  const payload = await apiClient<ApiEnvelope<{ id: string; confirmed: boolean; confirmedBy: string; confirmedAt: string }>>(
    `/guilds/${guildId}/attendance/entries/${entryId}/confirm`,
    {
      method: "PATCH",
    },
  );
  return unwrap(payload);
}

export async function bulkConfirmAttendanceEntries(
  guildId: string,
  entryIds: string[],
): Promise<{ confirmed: number; entries: any[] }> {
  const payload = await apiClient<ApiEnvelope<{ confirmed: number; entries: any[] }>>(
    `/guilds/${guildId}/attendance/entries/bulk-confirm`,
    {
      method: "POST",
      body: JSON.stringify({ entryIds }),
    },
  );
  return unwrap(payload);
}

