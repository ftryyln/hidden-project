"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionCard } from "@/components/responsive/section-card";
import type { AuditLog } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UUID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WHITELISTED_METADATA_KEYS = new Set([
  "item_name",
  "total_share",
  "role",
  "source",
  "category",
  "tx_type",
  "amount",
  "description",
]);

function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(key: string, value: unknown): string {
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string") {
    if (["role", "source", "tx_type", "category", "description", "item_name"].includes(key)) {
      return formatKeyLabel(value.toLowerCase());
    }
    return value;
  }
  return "";
}

interface AuditLogSectionProps {
  logs: AuditLog[];
  loading: boolean;
  onRefresh: () => void;
  onLoadMore?: () => void;
  canLoadMore?: boolean;
  isFetchingMore?: boolean;
  formatRelativeTime: (iso: string | null | undefined) => string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: Array<{ value: string; label: string }>;
}

export function AuditLogSection({
  logs,
  loading,
  onRefresh,
  onLoadMore,
  canLoadMore,
  isFetchingMore,
  formatRelativeTime,
  filterValue,
  onFilterChange,
  filterOptions,
}: AuditLogSectionProps) {
  return (
    <SectionCard
      title="Audit log"
      description="Track invite activity and access changes."
      actions={
        <div className="flex flex-wrap gap-2">
          <Select value={filterValue} onValueChange={onFilterChange}>
            <SelectTrigger className="w-40 rounded-full border-border/60 bg-muted/40 text-xs font-semibold uppercase tracking-wide">
              <SelectValue placeholder="Filter actions" />
            </SelectTrigger>
            <SelectContent align="end">
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh audit log"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canLoadMore && onLoadMore && (
            <Button type="button" variant="outline" onClick={onLoadMore} disabled={isFetchingMore}>
              {isFetchingMore ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        )}

        {!loading && logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
        )}

        {!loading && logs.length > 0 && (
          <ScrollArea className="h-[60vh] rounded-2xl border border-border/40 p-4">
            <div className="space-y-3">
              {logs.map((log) => {
                const actorLabel = log.actor_name ?? "System";
                const derivedTarget =
                  typeof log.metadata?.target_name === "string"
                    ? (log.metadata.target_name as string)
                    : typeof log.metadata?.member_name === "string"
                      ? (log.metadata.member_name as string)
                      : null;
                const targetLabel = log.target_name ?? derivedTarget ?? null;

                const displayMetadata = Object.entries(log.metadata ?? {}).filter(([key, value]) => {
                  const normalized = key.toLowerCase();
                  if (normalized.endsWith("_id")) return false;
                  if (normalized.endsWith("_at")) return false;
                  if (normalized.endsWith("_by")) return false;
                  if (!WHITELISTED_METADATA_KEYS.has(normalized)) return false;
                  if (typeof value === "string" && UUID_REGEXP.test(value)) return false;
                  if (typeof value === "object" && value !== null) return false;
                  return true;
                });

                return (
                  <div key={log.id} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold uppercase">{log.action.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">{actorLabel}</span>
                      {targetLabel && (
                        <>
                          <span className="text-muted-foreground">{" -> "}</span>
                          <span>{targetLabel}</span>
                        </>
                      )}
                    </div>
                    {displayMetadata.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {displayMetadata.map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                          >
                            {formatKeyLabel(key)}: {formatMetadataValue(key.toLowerCase(), value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </SectionCard>
  );
}
