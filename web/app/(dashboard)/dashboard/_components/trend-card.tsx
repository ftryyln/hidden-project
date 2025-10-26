"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthlyAreaChart } from "@/components/charts/monthly-area-chart";
import type { MonthlySummaryPoint } from "@/lib/types";

interface TrendCardProps {
  data: MonthlySummaryPoint[] | undefined;
  loading?: boolean;
}

export function TrendCard({ data, loading }: TrendCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs. expense trend</CardTitle>
        <CardDescription>Last 12 months</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : (
          <MonthlyAreaChart data={data ?? []} />
        )}
      </CardContent>
    </Card>
  );
}
