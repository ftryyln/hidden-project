"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "@/lib/api/guilds";
import { useGuilds } from "@/hooks/queries/use-guilds";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Users, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { toApiError } from "@/lib/api/errors";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { DashboardHeader } from "./_components/dashboard-header";
import { KpiGrid } from "./_components/kpi-grid";
import { RecentActivityCard } from "./_components/recent-activity-card";
import { TableCard } from "./_components/table-card";
import { TrendCard } from "./_components/trend-card";

export default function DashboardPage() {
  const toast = useToast();
  const guildsQuery = useGuilds();
  const { selectedGuild, changeGuild } = useDashboardGuild();

  useEffect(() => {
    if (!selectedGuild && guildsQuery.data?.length) {
      changeGuild(guildsQuery.data[0].id);
    }
  }, [selectedGuild, guildsQuery.data, changeGuild]);

  const guildId = selectedGuild ?? undefined;

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", guildId],
    queryFn: () => fetchDashboard(guildId),
    enabled: Boolean(guildId),
  });

  useEffect(() => {
    if (dashboardQuery.isError) {
      void (async () => {
        const error = await toApiError(dashboardQuery.error);
        toast({
          title: "Failed to load dashboard",
          description: error.message,
        });
      })();
    }
  }, [dashboardQuery.isError, dashboardQuery.error, toast]);

  const guildName = useMemo(() => {
    const guild = guildsQuery.data?.find((g) => g.id === guildId);
    return guild?.name ?? "Guild overview";
  }, [guildsQuery.data, guildId]);

  if (!guildId) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-[320px] rounded-3xl" />
      </div>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={guildName}
        description="Track guild health, cash flow, and loot distribution in real time."
      />

      <KpiGrid
        loading={dashboardQuery.isLoading}
        items={[
          {
            title: "Active members",
            icon: <Users className="h-5 w-5" />,
            value: data?.kpis.active_members ?? 0,
          },
          {
            title: "Guild balance",
            icon: <Wallet className="h-5 w-5" />,
            value: formatCurrency(data?.kpis.guild_balance ?? 0),
          },
          {
            title: "Income this month",
            icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
            value: formatCurrency(data?.kpis.income_month ?? 0),
          },
          {
            title: "Expense this month",
            icon: <TrendingDown className="h-5 w-5 text-amber-400" />,
            value: formatCurrency(data?.kpis.expense_month ?? 0),
          },
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <TrendCard data={data?.monthlySeries} loading={dashboardQuery.isLoading} />
        <RecentActivityCard logs={data?.audit} loading={dashboardQuery.isLoading} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <TableCard
          title="Latest transactions"
          description="Draft and newly confirmed transactions"
          columns={["Date", "Category", "Amount", "Status"]}
          rows={
            data?.recentTransactions?.map((tx) => ({
              key: tx.id,
              cells: [
                formatDateTime(tx.created_at),
                <div className="flex items-center gap-2" key="category">
                  <Badge
                    variant={
                      tx.tx_type === "income"
                        ? "success"
                        : tx.tx_type === "expense"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {tx.tx_type}
                  </Badge>
                  <span>{tx.category}</span>
                </div>,
                formatCurrency(tx.amount),
                <Badge variant={tx.confirmed ? "success" : "warning"}>
                  {tx.confirmed ? "Confirmed" : "Pending"}
                </Badge>,
              ],
            })) ?? []
          }
          loading={dashboardQuery.isLoading}
          emptyMessage="No transactions recorded yet."
          skeletonHeight={160}
        />

        <TableCard
          title="Latest loot"
          description="Key drops from recent raids"
          columns={["Date", "Item", "Value", "Status"]}
          rows={
            data?.recentLoot?.map((loot) => ({
              key: loot.id,
              cells: [
                formatDateTime(loot.created_at),
                <div className="flex flex-col" key="item">
                  <span className="font-medium">{loot.item_name}</span>
                  <span className="text-xs text-muted-foreground">{loot.boss_name}</span>
                </div>,
                formatCurrency(loot.estimated_value),
                <Badge variant={loot.distributed ? "success" : "warning"}>
                  {loot.distributed ? "Distributed" : "Pending"}
                </Badge>,
              ],
            })) ?? []
          }
          loading={dashboardQuery.isLoading}
          emptyMessage="No loot has been recorded yet."
          skeletonHeight={160}
        />
      </section>
    </div>
  );
}
