"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, Clock4, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { listMembers } from "@/lib/api/members";
import {
  createAttendanceSession,
  deleteAttendanceSession,
  fetchAttendanceDetail,
  fetchAttendanceHistory,
  fetchAttendanceSessions,
  updateAttendanceSession,
  type AttendanceListParams,
  type AttendancePayload,
} from "@/lib/api/attendance";
import type {
  AttendanceDetail,
  AttendanceEntry,
  AttendanceHistoryItem,
  AttendanceSessionSummary,
  Member,
} from "@/lib/types";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { useToast } from "@/components/ui/use-toast";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd MMM yyyy • HH:mm");
}

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
  const [detailSession, setDetailSession] = useState<AttendanceSessionSummary | null>(null);
  const [detailEntries, setDetailEntries] = useState<AttendanceEntry[]>([]);
  const [historyItems, setHistoryItems] = useState<AttendanceHistoryItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (guildId && guildId !== selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

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
  });

  const membersQuery = useQuery({
    queryKey: ["guild", guildId, "members", "active"],
    queryFn: () => listMembers(guildId!, { active: true, pageSize: 100 }),
    enabled: Boolean(guildId),
  });

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
      queryClient.invalidateQueries({ queryKey: ["attendance", guildId, "detail"] });
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

  const filteredMembers = membersQuery.data?.members ?? [];

  const sessions = sessionsQuery.data?.items ?? [];
  const meta = sessionsQuery.data?.meta;

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

  const handleViewDetail = async (sessionId: string) => {
    if (!guildId) return;
    const detail = await fetchAttendanceDetail(guildId, sessionId);
    setDetailSession(detail.session);
    setDetailEntries(detail.entries);
    const history = await fetchAttendanceHistory(guildId, sessionId);
    setHistoryItems(history);
    setDetailOpen(true);
  };

  const handleDelete = (sessionId: string) => {
    if (!confirm("Delete this attendance session?")) return;
    deleteMutation.mutate(sessionId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Track who showed up for each boss or map run, including timestamps and loot eligibility.
          </p>
        </div>
        <Button onClick={handleOpenCreate}>Record attendance</Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-6 md:grid-cols-4">
          <div>
            <Label>Search</Label>
            <Input
              placeholder="Boss or map"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value, page: 1 }))
              }
            />
          </div>
          <div>
            <Label>Boss</Label>
            <Input
              value={filters.bossName}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, bossName: event.target.value, page: 1 }))
              }
              placeholder="e.g. Yeti King"
            />
          </div>
          <div>
            <Label>Map</Label>
            <Input
              value={filters.mapName}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, mapName: event.target.value, page: 1 }))
              }
              placeholder="e.g. Frozen Plateau"
            />
          </div>
          <div className="flex items-end justify-end">
            <Button
              variant="outline"
              onClick={() => setFilters(defaultFilters)}
              disabled={
                !filters.search && !filters.bossName && !filters.mapName && filters.page === 1
              }
            >
              Reset filters
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <AttendanceRow
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

      <AttendanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        members={filteredMembers}
        sessionId={editingSessionId}
        initialDetail={editingDetail}
        onSubmit={(payload) => {
          if (editingSessionId) {
            updateMutation.mutate({ sessionId: editingSessionId, payload });
          } else {
            createMutation.mutate(payload);
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attendance detail</DialogTitle>
          </DialogHeader>
          {detailSession ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(detailSession.startedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  {detailSession.bossName && (
                    <Badge variant="secondary">Boss: {detailSession.bossName}</Badge>
                  )}
                  {detailSession.mapName && (
                    <Badge variant="secondary">Map: {detailSession.mapName}</Badge>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold">Attendees</h4>
                <div className="mt-2 space-y-2 rounded-xl border border-border/60 p-4">
                  {detailEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No entries recorded.</p>
                  ) : (
                    detailEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-border/40 bg-muted/10 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span>{entry.memberName ?? "Unknown member"}</span>
                          {entry.lootTag && (
                            <Badge variant="outline" className="text-[11px] uppercase">
                              {entry.lootTag}
                            </Badge>
                          )}
                        </div>
                        {entry.note && (
                          <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold">History</h4>
                <div className="mt-2 space-y-3">
                  {historyItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No history yet.</p>
                  ) : (
                    historyItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/40 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.performedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.performerName ?? "Unknown user"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a session to view details.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AttendanceRowProps {
  session: AttendanceSessionSummary;
  onViewDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function AttendanceRow({
  session,
  onViewDetail,
  onEdit,
  onDelete,
  isDeleting,
}: AttendanceRowProps) {
  return (
    <div className="rounded-2xl border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {session.bossName && (
              <Badge variant="secondary" className="text-xs">
                Boss • {session.bossName}
              </Badge>
            )}
            {session.mapName && (
              <Badge variant="outline" className="text-xs">
                Map • {session.mapName}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDate(session.startedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{session.attendeesCount} attendees</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock4 className="h-4 w-4" />
            <span>{formatDate(session.updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onViewDetail(session.id)}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(session.id)}>
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(session.id)}
            disabled={isDeleting}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AttendanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  sessionId: string | null;
  initialDetail: AttendanceDetail | null;
  onSubmit: (payload: AttendancePayload) => void;
  isSubmitting: boolean;
}

interface AttendeeState {
  memberId: string;
  note?: string;
  lootTag?: string;
}

function AttendanceFormDialog({
  open,
  onOpenChange,
  members,
  sessionId,
  initialDetail,
  onSubmit,
  isSubmitting,
}: AttendanceFormDialogProps) {
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [bossName, setBossName] = useState("");
  const [mapName, setMapName] = useState("");
  const [selected, setSelected] = useState<Record<string, AttendeeState>>({});

  useEffect(() => {
    if (!open) {
      setBossName("");
      setMapName("");
      setStartedAt(new Date().toISOString().slice(0, 16));
      setSelected({});
      return;
    }

    if (sessionId && initialDetail) {
      setBossName(initialDetail.session.bossName ?? "");
      setMapName(initialDetail.session.mapName ?? "");
      setStartedAt(initialDetail.session.startedAt.slice(0, 16));
      const mapped: Record<string, AttendeeState> = {};
      initialDetail.entries.forEach((entry) => {
        mapped[entry.memberId] = {
          memberId: entry.memberId,
          note: entry.note ?? undefined,
          lootTag: entry.lootTag ?? undefined,
        };
      });
      setSelected(mapped);
    } else if (!sessionId) {
      setBossName("");
      setMapName("");
      setStartedAt(new Date().toISOString().slice(0, 16));
      setSelected({});
    }
  }, [open, sessionId, initialDetail]);

  const toggleMember = (memberId: string, checked: boolean) => {
    setSelected((prev) => {
      if (checked) {
        return prev[memberId]
          ? prev
          : {
              ...prev,
              [memberId]: { memberId },
            };
      }
      const next = { ...prev };
      delete next[memberId];
      return next;
    });
  };

  const handleSubmit = () => {
    const attendees = Object.values(selected);
    onSubmit({
      bossName: bossName || null,
      mapName: mapName || null,
      startedAt: new Date(startedAt).toISOString(),
      attendees: attendees.map((attendee) => ({
        memberId: attendee.memberId,
        note: attendee.note ?? null,
        lootTag: attendee.lootTag ?? null,
      })),
    });
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{sessionId ? "Edit attendance" : "Record attendance"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Boss Name</Label>
              <Input value={bossName} onChange={(event) => setBossName(event.target.value)} />
            </div>
            <div>
              <Label>Map Name</Label>
              <Input value={mapName} onChange={(event) => setMapName(event.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Start Time</Label>
              <Input
                type="datetime-local"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Attendees</p>
                <p className="text-xs text-muted-foreground">
                  Select members who participated. Add notes or loot tags if needed.
                </p>
              </div>
              <Badge variant="outline">{selectedCount} selected</Badge>
            </div>
            <div className="rounded-2xl border border-border/60">
              <ScrollArea className="max-h-72">
                {members.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No members available.</p>
                ) : (
                  <div className="divide-y">
                    {members.map((member) => {
                      const current = selected[member.id];
                      return (
                        <div key={member.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={Boolean(current)}
                              onCheckedChange={(next) =>
                                toggleMember(member.id, Boolean(next))
                              }
                            />
                            <div className="flex-1 space-y-2">
                              <div>
                                <p className="font-medium">{member.in_game_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {member.role_in_guild}
                                </p>
                              </div>
                              {current && (
                                <div className="grid gap-2 md:grid-cols-2">
                                  <div>
                                    <Label className="text-xs">Note</Label>
                                    <Textarea
                                      value={current.note ?? ""}
                                      onChange={(event) =>
                                        setSelected((prev) => ({
                                          ...prev,
                                          [member.id]: {
                                            ...prev[member.id],
                                            memberId: member.id,
                                            note: event.target.value,
                                          },
                                        }))
                                      }
                                      rows={2}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Loot Tag</Label>
                                    <Input
                                      value={current.lootTag ?? ""}
                                      onChange={(event) =>
                                        setSelected((prev) => ({
                                          ...prev,
                                          [member.id]: {
                                            ...prev[member.id],
                                            memberId: member.id,
                                            lootTag: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="e.g. Rare drop"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={selectedCount === 0 || isSubmitting}>
              {sessionId ? "Save changes" : "Record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
