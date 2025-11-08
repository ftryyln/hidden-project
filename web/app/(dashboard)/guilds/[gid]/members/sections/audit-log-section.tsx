"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionCard } from "@/components/responsive/section-card";
import type { AuditLog } from "@/lib/types";

interface AuditLogSectionProps {
  logs: AuditLog[];
  loading: boolean;
  onRefresh: () => void;
  onLoadMore?: () => void;
  canLoadMore?: boolean;
  isFetchingMore?: boolean;
  formatRelativeTime: (iso: string | null | undefined) => string;
}

export function AuditLogSection({
  logs,
  loading,
  onRefresh,
  onLoadMore,
  canLoadMore,
  isFetchingMore,
  formatRelativeTime,
}: AuditLogSectionProps) {
  return (
    <SectionCard
      title="Audit log"
      description="Track invite activity and access changes."
      actions={
        <div className="flex gap-2">
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
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-2">
              {logs.map((log) => {
                const displayMetadata = Object.entries(log.metadata ?? {}).filter(
                  ([key]) => !key.toLowerCase().endsWith("_id"),
                );

                return (
                  <div key={log.id} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold uppercase">{log.action.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">{log.actor_name ?? "System"}</span>
                      <span className="text-muted-foreground">{"->"}</span>
                      <span>{log.target_name ?? "N/A"}</span>
                    </div>
                    {displayMetadata.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {displayMetadata.map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                          >
                            {key}: {typeof value === "string" ? value : JSON.stringify(value)}
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
