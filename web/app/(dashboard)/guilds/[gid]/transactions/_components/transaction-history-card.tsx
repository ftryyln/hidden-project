"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AuditLog } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface TransactionHistoryCardProps {
  logs: AuditLog[];
  isLoading: boolean;
}

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Recent adds, edits, deletes, and confirmations.</CardDescription>
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
        {logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
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
      </CardContent>
    </Card>
  );
}
