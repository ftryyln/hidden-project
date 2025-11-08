"use client";

import { useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/format";

export function useRelativeTimeFormatter() {
  const formatRelativeTime = useCallback((iso: string | null | undefined) => {
    if (!iso) return "-";
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return formatDate(iso ?? undefined);
    }
  }, []);

  return { formatRelativeTime };
}
