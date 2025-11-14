"use client";

import type { AuditLog } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

interface RecentActivityCardProps {
  logs: AuditLog[] | undefined;
  loading?: boolean;
}

export function RecentActivityCard({ logs, loading }: RecentActivityCardProps) {
  const limitedLogs = logs?.slice(0, 3) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Transaction confirmations, loot distribution, and more</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        )}
        {!loading && limitedLogs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No recent activity yet. Log transactions or distribute loot to see updates here.
          </p>
        )}
        {!loading &&
          limitedLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-border/40 bg-background/60 p-3">
              <p className="text-sm font-semibold text-foreground">{log.action}</p>
              <p className="text-xs text-muted-foreground">
                {(log.actor_name ?? "System") + " - " + formatDateTime(log.created_at)}
              </p>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
