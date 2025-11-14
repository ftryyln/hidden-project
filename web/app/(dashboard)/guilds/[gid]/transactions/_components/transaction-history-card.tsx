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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AuditLog } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface TransactionHistoryCardProps {
  logs: AuditLog[];
  isLoading: boolean;
}

const PAGE_SIZE = 5;

const ACTION_FILTERS: Array<{ value: "all" | AuditLog["action"]; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "TRANSACTION_CREATED", label: "Created" },
  { value: "TRANSACTION_UPDATED", label: "Updated" },
  { value: "TRANSACTION_DELETED", label: "Deleted" },
  { value: "TRANSACTION_CONFIRMED", label: "Confirmed" },
];

function describeTransactionLog(log: AuditLog): string {
  const actor = log.actor_name ?? "Someone";
  const metadata = log.metadata ?? {};
  const category =
    typeof metadata.category === "string" && metadata.category.length > 0
      ? metadata.category
      : undefined;
  const txType =
    typeof metadata.tx_type === "string" && metadata.tx_type.length > 0
      ? metadata.tx_type
      : undefined;
  const amountValue =
    typeof metadata.amount === "number"
      ? metadata.amount
      : typeof metadata.amount === "string"
        ? Number(metadata.amount)
        : null;
  const amount =
    typeof amountValue === "number" && Number.isFinite(amountValue)
      ? formatCurrency(amountValue)
      : undefined;

  const baseDetails = [txType, category].filter(Boolean).join(" / ");
  const detailText = [amount, baseDetails].filter(Boolean).join(" - ");

  switch (log.action) {
    case "TRANSACTION_CREATED":
      return `${actor} created a transaction${detailText ? ` (${detailText})` : ""}.`;
    case "TRANSACTION_UPDATED":
      return `${actor} updated a transaction${detailText ? ` (${detailText})` : ""}.`;
    case "TRANSACTION_DELETED":
      return `${actor} deleted a transaction${detailText ? ` (${detailText})` : ""}.`;
    case "TRANSACTION_CONFIRMED":
      return `${actor} confirmed a transaction${detailText ? ` (${detailText})` : ""}.`;
    default:
      return `${actor} recorded activity.`;
  }
}

export function TransactionHistoryCard({ logs, isLoading }: TransactionHistoryCardProps) {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | AuditLog["action"]>("all");
  const [page, setPage] = useState(1);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const details = describeTransactionLog(log).toLowerCase();
      return matchesAction && (!query || details.includes(query));
    });
  }, [logs, search, actionFilter]);

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
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent adds, edits, deletes, and confirmations.</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity"
            className="rounded-full border-border/60 lg:w-64"
            aria-label="Search transaction history"
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
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </div>
        )}
        {!isLoading && logs.length > 0 && pageLogs.length === 0 && filtersActive && (
          <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
            No entries match your filters.
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
                  <p className="text-sm font-medium">{describeTransactionLog(log)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(log.created_at)} · {log.actor_name ?? "System"}
                  </p>
                </div>
                <Badge variant="outline" className="whitespace-nowrap">
                  {log.action.replace("TRANSACTION_", "").replace("_", " ")}
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
