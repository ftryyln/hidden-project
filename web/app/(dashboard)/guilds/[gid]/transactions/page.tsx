"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TransactionForm, type TransactionSchema } from "@/components/forms/transaction-form";
import {
  confirmTransaction,
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "@/lib/api/transactions";
import { useToast } from "@/components/ui/use-toast";
import type { Transaction, TransactionType } from "@/lib/types";
import type { DateRange } from "@/components/forms/date-range-picker";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { toApiError } from "@/lib/api/errors";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { fetchGuildAuditLogs } from "@/lib/api/guild-access";
import { TransactionSummaryCards } from "./_components/transaction-summary-cards";
import { TransactionListCard } from "./_components/transaction-list-card";
import { TransactionHistoryCard } from "./_components/transaction-history-card";

export default function TransactionsPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params.gid;
  const { selectedGuild, changeGuild } = useDashboardGuild();

  useEffect(() => {
    if (guildId && guildId !== selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const guildRole = deriveGuildRole(user ?? null, guildId);
  const permissions = getGuildPermissions(guildRole);

  useEffect(() => {
    if (!permissions.canManageTransactions) {
      setDialogOpen(false);
      setEditDialogOpen(false);
      setTransactionToEdit(null);
    }
  }, [permissions.canManageTransactions]);

  const PAGE_SIZE = 5;
  const [filters, setFilters] = useState<{
    range: DateRange;
    type?: TransactionType | "all";
  }>({
    range: {},
    type: "all",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const transactionsQuery = useQuery({
    queryKey: ["guild", guildId, "transactions", filters],
    queryFn: () =>
      listTransactions(guildId, {
        from: filters.range.from,
        to: filters.range.to,
        type: filters.type && filters.type !== "all" ? filters.type : undefined,
      }),
    enabled: Boolean(guildId),

  });

  const historyQuery = useQuery({
    queryKey: ["guild", guildId, "transactions", "history"],
    queryFn: () =>
      fetchGuildAuditLogs(guildId, {
        actions: [
          "TRANSACTION_CREATED",
          "TRANSACTION_UPDATED",
          "TRANSACTION_DELETED",
          "TRANSACTION_CONFIRMED",
        ],
        limit: 25,
      }),
    enabled: Boolean(guildId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: TransactionSchema) =>
      createTransaction(guildId, {
        tx_type: payload.tx_type,
        category: payload.category,
        amount: payload.amount,
        description: payload.description,
        evidence_path: payload.evidence_path,
      }),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions", "history"] }),
      ]);
      setDialogOpen(false);
      toast({
        title: "Transaction created",
        description: "Officers can confirm this transaction later.",
      });
    },

    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to save transaction",
        description: apiError.message,
      });
    },
  });


  const updateMutation = useMutation({
    mutationFn: async (payload: TransactionSchema) => {
      if (!transactionToEdit) {
        throw new Error("Transaction not selected");
      }

      return updateTransaction(guildId, transactionToEdit.id, {
        tx_type: payload.tx_type,
        category: payload.category,
        amount: payload.amount,
        description: payload.description,
        evidence_path: payload.evidence_path,
      });
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] });
      await queryClient.invalidateQueries({
        queryKey: ["guild", guildId, "transactions", "history"],
      });
      setEditDialogOpen(false);
      setTransactionToEdit(null);
      toast({
        title: "Transaction updated",
        description: "Changes have been saved.",
      });
    },

    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to update transaction",
        description: apiError.message,
      });
    },
  });


  const deleteMutation = useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(guildId, transactionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] });
      await queryClient.invalidateQueries({
        queryKey: ["guild", guildId, "transactions", "history"],
      });
      toast({
        title: "Transaction deleted",
        description: "The transaction has been removed.",
      });
    },

    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to delete transaction",
        description: apiError.message,
      });
    },
  });


  const confirmMutation = useMutation({
    mutationFn: (transactionId: string) => confirmTransaction(guildId, transactionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions", "history"] }),
      ]);
      toast({
        title: "Transaction confirmed",
        description: "The guild balance will include this transaction automatically.",
      });

    },

    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to confirm transaction",
        description: apiError.message,
      });
    },
  });


  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setEditDialogOpen(true);
  };


  const handleDeleteTransaction = (transaction: Transaction) => {
    if (deleteMutation.isPending) {
      return;
    }
    const confirmed = window.confirm("Delete this transaction? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(transaction.id);
  };


  const transactions = useMemo(
    () => transactionsQuery.data?.transactions ?? [],
    [transactionsQuery.data?.transactions],
  );

  const filteredTransactions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return transactions;
    return transactions.filter((tx) => {
      const category = (tx.category ?? "").toLowerCase();
      const description = (tx.description ?? "").toLowerCase();
      const creator = (tx.created_by_name ?? tx.created_by ?? "").toLowerCase();
      return category.includes(query) || description.includes(query) || creator.includes(query);
    });
  }, [transactions, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [filters.range.from, filters.range.to, filters.type, searchTerm]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pagedTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, page]);

  const transactionHistory = historyQuery.data ?? [];
  const isLoading = transactionsQuery.isLoading;
  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        if (tx.tx_type === "income") acc.income += tx.amount;
        if (tx.tx_type === "expense") acc.expense += tx.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const filtersActive =
    Boolean(filters.range.from) ||
    Boolean(filters.range.to) ||
    (filters.type && filters.type !== "all") ||
    Boolean(searchTerm.trim());

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guild Transactions</h2>
          <p className="text-sm text-muted-foreground">
            Record income and expenses, then confirm them before closing the books.
          </p>
        </div>

        {permissions.canManageTransactions && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)} className="rounded-full px-4">
                <PlusCircle className="mr-2 h-4 w-4" /> New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
              </DialogHeader>
              <TransactionForm
                loading={createMutation.isPending}
                onSubmit={async (values) => {
                  await createMutation.mutateAsync(values);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

        {permissions.canManageTransactions && transactionToEdit && (
          <Dialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setTransactionToEdit(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Transaction</DialogTitle>
              </DialogHeader>
              <TransactionForm
                defaultValues={{
                  tx_type: transactionToEdit.tx_type,
                  category: transactionToEdit.category,
                  amount: transactionToEdit.amount,
                  description: transactionToEdit.description ?? "",
                  evidence_path: transactionToEdit.evidence_path ?? "",
                }}
                loading={updateMutation.isPending}
                resetOnSubmit={false}
                onSubmit={async (values) => {
                  await updateMutation.mutateAsync(values);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

      </div>
      <TransactionSummaryCards income={summary.income} expense={summary.expense} />
      <TransactionListCard
        filters={filters}
        onRangeChange={(range) => setFilters((prev) => ({ ...prev, range }))}
        onTypeChange={(type) => setFilters((prev) => ({ ...prev, type }))}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] })}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        transactions={pagedTransactions}
        totalItems={filteredTransactions.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        filtersActive={filtersActive}
        isLoading={isLoading}
        canManageTransactions={permissions.canManageTransactions}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        onConfirm={(transactionId) => confirmMutation.mutate(transactionId)}
        deleteDisabled={deleteMutation.isPending}
        confirmDisabled={confirmMutation.isPending}
      />

      <TransactionHistoryCard logs={transactionHistory} isLoading={historyQuery.isLoading} />
    </div>
  );
}
