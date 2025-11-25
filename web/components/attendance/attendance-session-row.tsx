"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock4, Users } from "lucide-react";
import { format } from "date-fns";
import type { AttendanceSessionSummary } from "@/lib/types";

interface AttendanceSessionRowProps {
    session: AttendanceSessionSummary;
    onViewDetail: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    isDeleting: boolean;
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return format(date, "dd MMM yyyy • HH:mm");
}

export function AttendanceSessionRow({
    session,
    onViewDetail,
    onEdit,
    onDelete,
    isDeleting,
}: AttendanceSessionRowProps) {
    return (
        <div className="group rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/20 p-5 transition-all hover:border-border hover:shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {session.bossName && (
                            <Badge variant="default" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                                <span className="mr-1.5">⚔️</span>
                                {session.bossName}
                            </Badge>
                        )}
                        {session.mapName && (
                            <Badge variant="outline" className="rounded-full border-primary/30 text-primary">
                                <span className="mr-1.5">🗺️</span>
                                {session.mapName}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <CalendarIcon className="h-4 w-4" />
                            <span>{formatDate(session.startedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">{session.attendeesCount}</span>
                            <span>attendees</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock4 className="h-4 w-4" />
                            <span className="text-xs">Updated {formatDate(session.updatedAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetail(session.id)}
                        className="rounded-full hover:bg-primary/10 hover:text-primary"
                    >
                        View
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(session.id)}
                        className="rounded-full hover:bg-primary/10 hover:text-primary"
                    >
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(session.id)}
                        disabled={isDeleting}
                        className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
