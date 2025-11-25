"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMembers } from "@/lib/api/members";
import {
  createAttendanceSession,
  deleteAttendanceSession,
  fetchAttendanceDetail,
  updateAttendanceSession,
  fetchAttendanceSessions,
  fetchPendingAttendance,
  confirmAttendanceEntry,
  bulkConfirmAttendanceEntries,
  type AttendanceListParams,
  type AttendancePayload,
} from "@/lib/api/attendance";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { useToast } from "@/components/ui/use-toast";
import { PendingAttendanceCard } from "@/components/attendance/pending-attendance-card";
import { AttendanceFiltersCard } from "@/components/attendance/attendance-filters-card";
import { AttendanceSessionRow } from "@/components/attendance/attendance-session-row";
import { AttendanceDetailDialog } from "@/components/attendance/attendance-detail-dialog";
import type { AttendanceDetail, AttendanceSessionSummary } from "@/lib/types";

interface Filters extends AttendanceListParams {
  search?: string;
}

const defaultFilters: Filters = {
  page: 1,
  pageSize: 10,
  search: "",
  bossName: "",
  mapName: "",
};

export default function GuildAttendancePage() {
  const params = useParams<{ gid: string }>();
  const guildId = params?.gid;
  const { selectedGuild, changeGuild } = useDashboardGuild();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const debouncedSearch = useDebounce(filters.search ?? "", 300);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingDetail, setEditingDetail] = useState<AttendanceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (guildId && !selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

  // Queries
  const sessionsQuery = useQuery({
    queryKey: ["attendance", guildId, debouncedSearch, filters.bossName, filters.mapName, filters.page],
    queryFn: () =>
      fetchAttendanceSessions(guildId!, {
        page: filters.page,
        pageSize: filters.pageSize,
        search: debouncedSearch,
        bossName: filters.bossName,
        mapName: filters.mapName,
      }),
    enabled: Boolean(guildId),
    placeholderData: keepPreviousData,
  });

  const membersQuery = useQuery({
    queryKey: ["guild", guildId, "members", "active"],
    queryFn: () => listMembers(guildId!, { active: true, pageSize: 100 }),
    enabled: Boolean(guildId),
  });

  const pendingQuery = useQuery({
    queryKey: ["attendance", guildId, "pending"],
    queryFn: () => fetchPendingAttendance(guildId!),
    enabled: Boolean(guildId),
    refetchInterval: 30000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: AttendancePayload) => createAttendanceSession(guildId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId] });
      toast({ title: "Attendance recorded" });
      setFormOpen(false);
      setEditingSessionId(null);
    },
    onError: () => {
      toast({ title: "Failed to record attendance", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: AttendancePayload }) =>
      updateAttendanceSession(guildId!, sessionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId] });
      toast({ title: "Attendance updated" });
      setFormOpen(false);
      setEditingSessionId(null);
    },
    onError: () => {
      toast({ title: "Failed to update attendance", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteAttendanceSession(guildId!, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId] });
      toast({ title: "Attendance deleted" });
    },
    onError: () => toast({ title: "Failed to delete attendance", variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (entryId: string) => confirmAttendanceEntry(guildId!, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId, "pending"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId] });
      toast({ title: "Attendance confirmed" });
    },
    onError: () => toast({ title: "Failed to confirm attendance", variant: "destructive" }),
  });

  const bulkConfirmMutation = useMutation({
    mutationFn: (entryIds: string[]) => bulkConfirmAttendanceEntries(guildId!, entryIds),
    onSuccess: (data: { confirmed: number }) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId, "pending"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId] });
      toast({ title: `Confirmed ${data.confirmed} attendance entries` });
    },
    onError: () => toast({ title: "Failed to bulk confirm attendance", variant: "destructive" }),
  });

  // Handlers
  const handlePageChange = (next: number) => {
    setFilters((prev) => ({ ...prev, page: Math.max(next, 1) }));
  };

  const handleOpenCreate = () => {
    setEditingSessionId(null);
    setEditingDetail(null);
    setFormOpen(true);
  };

  const handleEdit = async (sessionId: string) => {
    if (!guildId) return;
    try {
      const detail = await fetchAttendanceDetail(guildId, sessionId);
      setEditingDetail(detail);
      setEditingSessionId(sessionId);
      setFormOpen(true);
    } catch {
      toast({ title: "Unable to load attendance detail", variant: "destructive" });
    }
  };

  const handleViewDetail = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setDetailOpen(true);
  };

  const handleDelete = (sessionId: string) => {
    if (!confirm("Delete this attendance session?")) return;
    deleteMutation.mutate(sessionId);
  };

  const handleSubmit = (payload: AttendancePayload) => {
    if (editingSessionId) {
      updateMutation.mutate({ sessionId: editingSessionId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const sessions = sessionsQuery.data?.items ?? [];
  const meta = sessionsQuery.data?.meta;
  const filteredMembers = membersQuery.data?.members ?? [];
  const pendingEntries = pendingQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Track who showed up for each boss or map run, including timestamps and loot eligibility.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>Record Attendance</Button>
      </div>

      <PendingAttendanceCard
        entries={pendingEntries}
        onConfirm={(entryId) => confirmMutation.mutate(entryId)}
        onConfirmAll={(entryIds) => bulkConfirmMutation.mutate(entryIds)}
        isConfirming={confirmMutation.isPending}
        isBulkConfirming={bulkConfirmMutation.isPending}
      />

      <AttendanceFiltersCard
        filters={{
          search: filters.search ?? "",
          bossName: filters.bossName ?? "",
          mapName: filters.mapName ?? "",
        }}
        onFiltersChange={(newFilters) =>
          setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }))
        }
        onReset={() => setFilters(defaultFilters)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recorded sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading attendance…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session: AttendanceSessionSummary) => (
                <AttendanceSessionRow
                  key={session.id}
                  session={session}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onViewDetail={handleViewDetail}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === session.id}
                />
              ))}
            </div>
          )}
          {meta && meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {meta.page} of {meta.totalPages}
              </span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
                  disabled={meta.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(meta.page + 1, meta.totalPages))}
                  disabled={meta.page >= meta.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form dialog temporarily disabled - use existing functionality */}
      {/* TODO: Implement full form dialog component */}

      <AttendanceDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        guildId={guildId ?? ""}
        sessionId={selectedSessionId}
      />
    </div>
  );
}
