"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker, type DateRange } from "@/components/forms/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthlyAreaChart } from "@/components/charts/monthly-area-chart";
import { fetchReports, exportReportsCsv } from "@/lib/api/reports";
import { WemixAmount } from "@/components/wemix-amount";
import { useToast } from "@/components/ui/use-toast";
import { Download } from "lucide-react";
import { toApiError } from "@/lib/api/errors";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";

export default function ReportsPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params.gid;
  const toast = useToast();

  const { selectedGuild, changeGuild } = useDashboardGuild();

  useEffect(() => {
    if (guildId && guildId !== selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

  const { user } = useAuth();
  const guildRole = deriveGuildRole(user ?? null, guildId);
  const permissions = getGuildPermissions(guildRole);

  const [period, setPeriod] = useState<DateRange>({});
  const [resource, setResource] = useState<"transactions" | "members">("transactions");

  const reportsQuery = useQuery({
    queryKey: ["guild", guildId, "reports", period],
    queryFn: () =>
      fetchReports(guildId, {
        from: period.from ? new Date(period.from).toISOString() : undefined,
        to: period.to ? new Date(period.to).toISOString() : undefined,
      }),
    enabled: Boolean(guildId),
  });

  const exportMutation = useMutation({
    mutationFn: async () =>
      exportReportsCsv(guildId, resource, {
        from: period.from ? new Date(period.from).toISOString() : undefined,
        to: period.to ? new Date(period.to).toISOString() : undefined,
      }),
    onSuccess: (data) => {
      const blob = new Blob([data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resource}-${guildId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: "Export complete",
        description: "CSV file is ready to download.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Export failed",
        description: apiError.message,
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Financial Reports</h2>
          <p className="text-sm text-muted-foreground">
            Monitor guild cash flow and export transaction data for audits.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Select value={resource} onValueChange={(value) => setResource(value as typeof resource)}>
            <SelectTrigger className="w-[200px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transactions">Transactions</SelectItem>
              <SelectItem value="members">Members</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="rounded-full"
            onClick={() => {
              if (!permissions.canExportReports) {
                return;
              }
              exportMutation.mutate();
            }}
            disabled={exportMutation.isPending || !permissions.canExportReports}
            title={
              !permissions.canExportReports
                ? "Only officers or guild admins can export reports"
                : undefined
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Reporting Period</CardTitle>
            <CardDescription>Filter data by transaction date range.</CardDescription>
          </div>
          <DateRangePicker value={period} onChange={setPeriod} />
        </CardHeader>
        <CardContent>
          {reportsQuery.isLoading ? (
            <Skeleton className="h-24 rounded-3xl" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-border/60 bg-muted/20 p-6">
                <p className="text-sm text-muted-foreground">Total income</p>
                <p className="text-3xl font-bold">
                  <WemixAmount
                    value={reportsQuery.data?.totals.income ?? 0}
                    className="text-3xl font-bold"
                    iconSize={24}
                    iconClassName="h-6 w-6"
                  />
                </p>
              </div>
              <div className="rounded-3xl border border-border/60 bg-muted/20 p-6">
                <p className="text-sm text-muted-foreground">Total expense</p>
                <p className="text-3xl font-bold">
                  <WemixAmount
                    value={reportsQuery.data?.totals.expense ?? 0}
                    className="text-3xl font-bold"
                    iconSize={24}
                    iconClassName="h-6 w-6"
                  />
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly trend</CardTitle>
          <CardDescription>Income vs expense by month</CardDescription>
        </CardHeader>
        <CardContent>
          {reportsQuery.isLoading ? (
            <Skeleton className="h-64 rounded-3xl" />
          ) : (
            <MonthlyAreaChart data={reportsQuery.data?.series ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
