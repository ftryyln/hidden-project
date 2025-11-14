"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { SalarySourceSelector } from "@/components/payroll/salary-source-selector";
import { SalarySummaryCard } from "@/components/payroll/salary-summary-card";
import { SalaryForm } from "@/components/payroll/salary-form";
import { SalaryHistoryTable } from "@/components/payroll/salary-history-table";
import { SalaryBatchDetailDialog } from "@/components/payroll/salary-batch-detail-dialog";
import {
  createPayrollBatch,
  fetchPayrollBatches,
  fetchPayrollBatchDetail,
  fetchPayrollSummary,
  type PayrollBatchCreationPayload,
} from "@/lib/api/payroll";
import { listMembers } from "@/lib/api/members";
import { useToast } from "@/components/ui/use-toast";
import { toApiError } from "@/lib/api/errors";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole } from "@/lib/permissions";
import type { PayrollBatchListItem, PayrollSource } from "@/lib/types";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";

export default function GuildSalaryPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params?.gid;
  const { selectedGuild, changeGuild } = useDashboardGuild();

  useEffect(() => {
    if (guildId && guildId !== selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const role = deriveGuildRole(user ?? null, guildId);
  const canDistribute =
    role === "guild_admin" || role === "officer" || role === "super_admin";

  const [source, setSource] = useState<PayrollSource>("TRANSACTION");
  const [page, setPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["guild", guildId, "payroll", "summary", source],
    queryFn: () => fetchPayrollSummary(guildId!, source),
    enabled: Boolean(guildId),
    staleTime: 30_000,
  });

  const membersQuery = useQuery({
    queryKey: ["guild", guildId, "payroll", "members"],
    queryFn: () => listMembers(guildId!, { pageSize: 100, active: true }),
    enabled: Boolean(guildId && canDistribute),
  });

  const batchesQuery = useQuery({
    queryKey: ["guild", guildId, "payroll", "batches", source, page],
    queryFn: () =>
      fetchPayrollBatches(guildId!, {
        source,
        page,
        pageSize: 10,
      }),
    enabled: Boolean(guildId),
    placeholderData: keepPreviousData,
  });

  const batchDetailQuery = useQuery({
    queryKey: ["guild", guildId, "payroll", "batch-detail", selectedBatchId],
    queryFn: () => fetchPayrollBatchDetail(guildId!, selectedBatchId!),
    enabled: Boolean(guildId && selectedBatchId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PayrollBatchCreationPayload) => createPayrollBatch(guildId!, payload),
    onSuccess: async () => {
      toast({
        title: "Salary distributed",
        description: "Payroll batch has been recorded.",
      });
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "payroll", "summary"] }),
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "payroll", "batches"] }),
      ]);
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to distribute salary",
        description: apiError.message,
      });
    },
  });

  const members = membersQuery.data?.members ?? [];
  const history = batchesQuery.data?.data ?? [];
  const meta = batchesQuery.data?.meta;

  const selectedBatch = batchDetailQuery.data;
  const summary = summaryQuery.data;

  const handleSourceChange = (next: PayrollSource) => {
    setSource(next);
    setPage(1);
  };

  const handleViewDetail = (batchId: string) => {
    setSelectedBatchId(batchId);
  };

  const closeDetail = () => {
    setSelectedBatchId(null);
  };

  const demoHistory = useMemo<PayrollBatchListItem[]>(() => {
    return [
      {
        id: "demo-batch",
        createdAt: new Date("2025-11-13T20:30:00Z").toISOString(),
        source: "LOOT",
        totalAmount: 5_000_000,
        membersCount: 5,
        distributedByName: "Kyuto Fit",
        periodFrom: "2025-11-01",
        periodTo: "2025-11-13",
        mode: "EQUAL",
        referenceCode: "PAY-20251113-DEMO",
      },
    ];
  }, []);

  const hasRealHistory = history.length > 0;
  const historyData = hasRealHistory ? history : demoHistory;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Guild Member Salary</h1>
        <p className="text-sm text-muted-foreground">
          Manage payroll disbursement from transactions or loot. Review balances, pick members, and keep a batch audit trail.
        </p>
      </div>

      <SalarySourceSelector value={source} onChange={handleSourceChange} />

      <SalarySummaryCard
        source={source}
        availableBalance={summary?.availableBalance}
        asOf={summary?.asOf}
        isLoading={summaryQuery.isLoading}
      />

      {canDistribute ? (
        <SalaryForm
          source={source}
          availableBalance={summary?.availableBalance ?? 0}
          members={members}
          onSubmit={(payload) => createMutation.mutateAsync(payload)}
          isSubmitting={createMutation.isPending}
        />
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          You can view the salary history, but only guild admins or officers can distribute payments.
        </div>
      )}

      <SalaryHistoryTable
        data={historyData}
        isLoading={batchesQuery.isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) =>
          setPage(Math.max(1, Math.min(nextPage, totalPages || nextPage)))
        }
        onSelectBatch={(batchId) => handleViewDetail(batchId)}
        actionsDisabled={!hasRealHistory}
      />

      <SalaryBatchDetailDialog
        open={Boolean(selectedBatchId)}
        onOpenChange={(open) => {
          if (!open) {
            closeDetail();
          }
        }}
        batch={selectedBatch}
        isLoading={batchDetailQuery.isLoading && Boolean(selectedBatchId)}
      />
    </div>
  );
}
