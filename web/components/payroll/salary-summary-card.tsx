"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import type { PayrollSource } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { WemixAmount } from "@/components/wemix-amount";

function getSourceLabel(source: PayrollSource): string {
  return source === "TRANSACTION" ? "Transactions" : "Loot";
}

interface SalarySummaryCardProps {
  source: PayrollSource;
  availableBalance?: number;
  asOf?: string;
  isLoading?: boolean;
}

export function SalarySummaryCard({
  source,
  availableBalance,
  asOf,
  isLoading,
}: SalarySummaryCardProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardDescription>Available Balance</CardDescription>
          <CardTitle className="mt-1 flex items-center gap-3 text-3xl">
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <WemixAmount
                value={availableBalance ?? 0}
                className="text-3xl font-bold"
                iconSize={24}
                iconClassName="h-6 w-6"
              />
            )}
          </CardTitle>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          {getSourceLabel(source)}
        </Badge>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <p>As of {asOf ? formatDateTime(asOf) : "-"}</p>
        )}
      </CardContent>
    </Card>
  );
}
