"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { PendingAttendanceEntry } from "@/lib/api/attendance";

interface PendingAttendanceCardProps {
    entries: PendingAttendanceEntry[];
    onConfirm: (entryId: string) => void;
    onConfirmAll: (entryIds: string[]) => void;
    isConfirming: boolean;
    isBulkConfirming: boolean;
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return format(date, "dd MMM yyyy • HH:mm");
}

export function PendingAttendanceCard({
    entries,
    onConfirm,
    onConfirmAll,
    isConfirming,
    isBulkConfirming,
}: PendingAttendanceCardProps) {
    if (entries.length === 0) return null;

    return (
        <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <span>⏳</span>
                            Pending Confirmation
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            {entries.length} attendance entries waiting for confirmation
                        </p>
                    </div>
                    <Button
                        onClick={() => onConfirmAll(entries.map((e) => e.entryId))}
                        disabled={isBulkConfirming}
                        size="sm"
                    >
                        Confirm All
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {entries.map((entry) => (
                        <div
                            key={entry.entryId}
                            className="flex items-center justify-between rounded-lg border bg-background p-3"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{entry.memberName}</span>
                                    {entry.discordUsername && (
                                        <Badge variant="outline" className="text-xs">
                                            @{entry.discordUsername}
                                        </Badge>
                                    )}
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{entry.sessionName}</span>
                                    <span>•</span>
                                    <span>{formatDate(entry.createdAt)}</span>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onConfirm(entry.entryId)}
                                disabled={isConfirming}
                            >
                                Confirm
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
