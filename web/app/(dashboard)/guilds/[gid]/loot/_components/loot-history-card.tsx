"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

interface LootHistoryCardProps {
  logs: AuditLog[];
  loading: boolean;
}

function describeLootLog(log: AuditLog): string {
  const actor = log.actor_name ?? "Someone";
  const metadata = log.metadata ?? {};
  const itemName =
    typeof metadata.item_name === "string" && metadata.item_name.length > 0 ? metadata.item_name : undefined;
  const bossName =
    typeof metadata.boss_name === "string" && metadata.boss_name.length > 0 ? metadata.boss_name : undefined;
  const label = itemName ? itemName : "loot";
  const bossLabel = bossName ? ` from ${bossName}` : "";

  switch (log.action) {
    case "LOOT_CREATED":
      return `${actor} recorded ${label}${bossLabel}.`;
    case "LOOT_UPDATED":
      return `${actor} updated ${label}${bossLabel}.`;
    case "LOOT_DELETED":
      return `${actor} removed ${label}${bossLabel}.`;
    case "LOOT_DISTRIBUTED":
      return `${actor} distributed ${label}${bossLabel}.`;
    default:
      return `${actor} recorded loot activity.`;
  }
}

export function LootHistoryCard({ logs, loading }: LootHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loot History</CardTitle>
        <CardDescription>Audit log for loot entries and distributions.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No loot history recorded yet.
          </div>
        )}
        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between rounded-3xl border border-border/60 p-4">
                <div className="space-y-1 pr-4">
                  <p className="text-sm font-medium">{describeLootLog(log)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)} • {log.actor_name ?? "System"}
                  </p>
                </div>
                <Badge variant="outline" className="whitespace-nowrap">
                  {log.action.replace("LOOT_", "").replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
