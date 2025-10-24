"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "@/lib/services/guilds";
import { useGuilds } from "@/hooks/queries/use-guilds";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { MonthlyAreaChart } from "@/components/charts/monthly-area-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Users, Wallet, TrendingUp, TrendingDown } from "lucide-react";

const STORAGE_KEY = "guild-manager:selected-guild";

export default function DashboardPage() {
  const toast = useToast();
  const guildsQuery = useGuilds();
  const [guildId, setGuildId] = useState<string | undefined>();

  useEffect(() => {
    if (!guildId) {
      const stored =
        typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        setGuildId(stored);
      } else if (guildsQuery.data?.length) {
        setGuildId(guildsQuery.data[0].id);
      }
    }
  }, [guildId, guildsQuery.data]);

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", guildId],
    queryFn: () => fetchDashboard(guildId),
    enabled: Boolean(guildId),
  });

  useEffect(() => {
    if (dashboardQuery.isError) {
      toast({
        title: "Failed to load dashboard",
        description: dashboardQuery.error?.message ?? "An unexpected error occurred.",
      });
    }
  }, [dashboardQuery.isError, dashboardQuery.error, toast]);

  const guildName = useMemo(() => {
    const guild = guildsQuery.data?.find((g) => g.id === guildId);
    return guild ? `${guild.name} • ${guild.role}` : "Guild overview";
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{guildName}</h2>
        <p className="text-sm text-muted-foreground">
          Track guild health, cash flow, and loot distribution in real time.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Active members"
          icon={<Users className="h-5 w-5" />}
          value={data?.kpis.active_members ?? 0}
          loading={dashboardQuery.isLoading}
        />
        <KpiCard
          title="Guild balance"
          icon={<Wallet className="h-5 w-5" />}
          value={formatCurrency(data?.kpis.guild_balance ?? 0)}
          loading={dashboardQuery.isLoading}
        />
        <KpiCard
          title="Income this month"
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          value={formatCurrency(data?.kpis.income_month ?? 0)}
          loading={dashboardQuery.isLoading}
        />
        <KpiCard
          title="Expense this month"
          icon={<TrendingDown className="h-5 w-5 text-amber-400" />}
          value={formatCurrency(data?.kpis.expense_month ?? 0)}
          loading={dashboardQuery.isLoading}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Income vs. expense trend</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardQuery.isLoading ? (
              <Skeleton className="h-64 rounded-3xl" />
            ) : (
              <MonthlyAreaChart data={data?.monthlySeries ?? []} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Transaction confirmations, loot distribution, and more</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardQuery.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </div>
            )}
            {!dashboardQuery.isLoading && data?.audit?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recent activity yet. Log transactions or distribute loot to see updates here.
              </p>
            )}
            {!dashboardQuery.isLoading &&
              data?.audit?.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border/40 bg-background/60 p-3"
                >
                  <p className="text-sm font-semibold text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.user_name ?? "System"} · {formatDateTime(log.created_at)}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transaksi Terbaru</CardTitle>
            <CardDescription>Draft dan transaksi yang baru dikonfirmasi</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardQuery.isLoading ? (
              <Skeleton className="h-40 rounded-3xl" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentTransactions?.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDateTime(tx.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={tx.confirmed ? "success" : "warning"}>
                          {tx.confirmed ? "Confirmed" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.recentTransactions?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No transactions recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest loot</CardTitle>
            <CardDescription>Key drops from recent raids</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardQuery.isLoading ? (
              <Skeleton className="h-40 rounded-3xl" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentLoot?.map((loot) => (
                    <TableRow key={loot.id}>
                      <TableCell>{formatDateTime(loot.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{loot.item_name}</span>
                          <span className="text-xs text-muted-foreground">{loot.boss_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(loot.estimated_value)}</TableCell>
                      <TableCell>
                        <Badge variant={loot.distributed ? "success" : "warning"}>
                          {loot.distributed ? "Distributed" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data?.recentLoot?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        No loot has been recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface KpiCardProps {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  loading?: boolean;
}

function KpiCard({ title, icon, value, loading }: KpiCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-3 text-sm uppercase tracking-wide">
          {icon}
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-12 w-32 rounded-lg" />
        ) : (
          <span className="text-3xl font-bold">{value}</span>
        )}
      </CardContent>
    </Card>
  );
}
