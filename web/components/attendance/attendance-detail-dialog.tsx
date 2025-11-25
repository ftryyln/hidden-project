"use client";

import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon } from "lucide-react";
import { fetchAttendanceDetail, fetchAttendanceHistory } from "@/lib/api/attendance";
import { format } from "date-fns";

interface AttendanceDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    sessionId: string | null;
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return format(date, "dd MMM yyyy • HH:mm");
}

export function AttendanceDetailDialog({
    open,
    onOpenChange,
    guildId,
    sessionId,
}: AttendanceDetailDialogProps) {
    const detailQuery = useQuery({
        queryKey: ["attendance", guildId, "detail", sessionId],
        queryFn: () => fetchAttendanceDetail(guildId, sessionId!),
        enabled: Boolean(guildId) && Boolean(sessionId) && open,
    });

    const historyQuery = useQuery({
        queryKey: ["attendance", guildId, "history", sessionId],
        queryFn: () => fetchAttendanceHistory(guildId, sessionId!),
        enabled: Boolean(guildId) && Boolean(sessionId) && open,
    });

    const detail = detailQuery.data;
    const history = historyQuery.data ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Attendance detail</DialogTitle>
                </DialogHeader>
                {detailQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                ) : detail ? (
                    <div className="space-y-4">
                        <div className="grid gap-2 text-sm">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                <span>{formatDate(detail.session.startedAt)}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-muted-foreground">
                                {detail.session.bossName && (
                                    <Badge variant="secondary">Boss: {detail.session.bossName}</Badge>
                                )}
                                {detail.session.mapName && (
                                    <Badge variant="secondary">Map: {detail.session.mapName}</Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold">Attendees</h4>
                            <div className="mt-2 space-y-2 rounded-xl border border-border/60 p-4">
                                {detail.entries.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No entries recorded.</p>
                                ) : (
                                    detail.entries.map((entry) => (
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
                                {history.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No history yet.</p>
                                ) : (
                                    history.map((item) => (
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
    );
}
