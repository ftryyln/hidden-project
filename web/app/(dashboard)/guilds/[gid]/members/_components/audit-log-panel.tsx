"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { AuditLogSection } from "../sections";
import {
  AUDIT_FILTER_MAP,
  AUDIT_FILTER_OPTIONS,
  AUDIT_PAGE_SIZE,
  auditQueryKey,
  type AuditFilterKey,
} from "../constants";
import { fetchGuildAuditLogs } from "@/lib/api/guild-access";
import { useRelativeTimeFormatter } from "../use-relative-time";

interface AuditLogPanelProps {
  guildId?: string;
  canViewAudit: boolean;
}

export function AuditLogPanel({ guildId, canViewAudit }: AuditLogPanelProps) {
  const { formatRelativeTime } = useRelativeTimeFormatter();
  const [auditFilter, setAuditFilter] = useState<AuditFilterKey>("all");
  const auditFilterActions = AUDIT_FILTER_MAP[auditFilter];

  const auditQuery = useInfiniteQuery({
    queryKey: guildId ? auditQueryKey(guildId, auditFilter) : [],
    queryFn: async ({ pageParam }: { pageParam?: string }) =>
      fetchGuildAuditLogs(guildId!, {
        limit: AUDIT_PAGE_SIZE,
        cursor: pageParam,
        actions: auditFilterActions,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.length < AUDIT_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at),
    enabled: Boolean(guildId && canViewAudit),
  });

  if (!canViewAudit) {
    return null;
  }

  const logs = auditQuery.data?.pages.flat() ?? [];

  return (
    <AuditLogSection
      logs={logs}
      loading={auditQuery.isLoading}
      onRefresh={() => auditQuery.refetch()}
      onLoadMore={auditQuery.hasNextPage ? () => auditQuery.fetchNextPage() : undefined}
      canLoadMore={auditQuery.hasNextPage}
      isFetchingMore={auditQuery.isFetchingNextPage}
      formatRelativeTime={formatRelativeTime}
      filterValue={auditFilter}
      onFilterChange={(value) => setAuditFilter(value as AuditFilterKey)}
      filterOptions={AUDIT_FILTER_OPTIONS}
    />
  );
}
