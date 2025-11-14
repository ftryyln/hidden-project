"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AuditAction, AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface LootHistoryCardProps {
  logs: AuditLog[];
  loading: boolean;
}

type LootActionFilter = "all" | "LOOT_CREATED" | "LOOT_UPDATED" | "LOOT_DELETED" | "LOOT_DISTRIBUTED";

const ACTION_FILTERS: Array<{ value: LootActionFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "LOOT_CREATED", label: "Created" },
  { value: "LOOT_UPDATED", label: "Updated" },
  { value: "LOOT_DELETED", label: "Deleted" },
  { value: "LOOT_DISTRIBUTED", label: "Distributed" },
];

const LOOT_ACTION_SET = new Set<LootActionFilter>([
  "LOOT_CREATED",
  "LOOT_UPDATED",
  "LOOT_DELETED",
  "LOOT_DISTRIBUTED",
]);

const PAGE_SIZE = 5;

function getEffectiveAction(log: AuditLog): AuditAction {
  const fallback = log.metadata?.fallback_action;
  if (typeof fallback === "string") {
    return fallback as AuditAction;
  }
  return log.action;
}

function describeLootLog(log: AuditLog): string {
  const actor = log.actor_name ?? "Someone";
  const metadata = log.metadata ?? {};
  const itemName =
    typeof metadata.item_name === "string" && metadata.item_name.length > 0
      ? metadata.item_name
      : undefined;
  const bossName =
    typeof metadata.boss_name === "string" && metadata.boss_name.length > 0
      ? metadata.boss_name
      : undefined;
  const label = itemName ? itemName : "loot";
  const bossLabel = bossName ? ` from ${bossName}` : "";

  switch (getEffectiveAction(log)) {
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
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<LootActionFilter>("all");
  const [page, setPage] = useState(1);

  const lootLogs = useMemo(
    () =>
      logs.filter((log) =>
        LOOT_ACTION_SET.has(getEffectiveAction(log) as LootActionFilter),
      ),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lootLogs.filter((log) => {
      const action = getEffectiveAction(log);
      const matchesAction = actionFilter === "all" || action === actionFilter;
      const details = describeLootLog(log).toLowerCase();
      return matchesAction && (!query || details.includes(query));
    });
  }, [lootLogs, search, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pageLogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  const filtersActive = Boolean(search.trim()) || actionFilter !== "all";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Loot History</CardTitle>
          <CardDescription>Audit log for loot entries and distributions.</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search loot history"
            className="rounded-full border-border/60 lg:w-64"
            aria-label="Search loot activity"
          />
          <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as typeof actionFilter)}>
            <SelectTrigger className="rounded-full border-border/60 lg:w-48">
              <SelectValue placeholder="Action filter" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        )}
        {!loading && lootLogs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No loot history recorded yet.
          </div>
        )}
        {!loading && lootLogs.length > 0 && pageLogs.length === 0 && filtersActive && (
          <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No history matches the current filters.
          </div>
        )}
        {pageLogs.length > 0 && (
          <div className="space-y-3">
            {pageLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between rounded-3xl border border-border/60 p-4"
              >
                <div className="space-y-1 pr-4">
                  <p className="text-sm font-medium">{describeLootLog(log)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)} | {log.actor_name ?? "System"}
                  </p>
                </div>
                <Badge variant="outline" className="whitespace-nowrap">
                  {getEffectiveAction(log).replace("LOOT_", "").replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {pageLogs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
