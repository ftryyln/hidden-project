"use client";



import { useEffect, useMemo, useState } from "react";

import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {

  Card,

  CardContent,

  CardDescription,

  CardHeader,

  CardTitle,

} from "@/components/ui/card";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Skeleton } from "@/components/ui/skeleton";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { TransactionForm, type TransactionSchema } from "@/components/forms/transaction-form";
import {
  confirmTransaction,
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "@/lib/api/transactions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import type { AuditLog, Transaction, TransactionType } from "@/lib/types";

import { DateRangePicker, type DateRange } from "@/components/forms/date-range-picker";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CheckCircle2, Pencil, PlusCircle, RefreshCw, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";

import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { toApiError } from "@/lib/api/errors";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { fetchGuildAuditLogs } from "@/lib/api/guild-access";
import { WemixAmount } from "@/components/wemix-amount";

function describeTransactionLog(log: AuditLog): string {
  const actor = log.actor_name ?? "Someone";
  const metadata = log.metadata ?? {};
  const category =
    typeof metadata.category === "string" && metadata.category.length > 0
      ? metadata.category
      : undefined;
  const txType =
    typeof metadata.tx_type === "string" && metadata.tx_type.length > 0
      ? metadata.tx_type
      : undefined;
  const amountValue =
    typeof metadata.amount === "number"
      ? metadata.amount
      : typeof metadata.amount === "string"
        ? Number(metadata.amount)
        : null;
  const amount =
    typeof amountValue === "number" && Number.isFinite(amountValue)
      ? formatCurrency(amountValue)
      : undefined;

  const baseDetails = [txType, category].filter(Boolean).join(" / ");
  const detailText = [amount, baseDetails].filter(Boolean).join(" - ");

  switch (log.action) {
    case "TRANSACTION_CREATED":
      return `${actor} created a transaction${detailText ? ` (${detailText})` : ""}.`;
    case "TRANSACTION_UPDATED":
      return `${actor} updated a transaction${detailText ? ` (${detailText})` : ""}.`;
    case "TRANSACTION_DELETED":
      return `${actor} deleted a transaction${detailText ? ` (${detailText})` : ""}.`;
    case "TRANSACTION_CONFIRMED":
      return `${actor} confirmed a transaction${detailText ? ` (${detailText})` : ""}.`;
    default:
      return `${actor} recorded activity.`;
  }
}

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



  const [filters, setFilters] = useState<{

    range: DateRange;

    type?: TransactionType | "all";

  }>({

    range: {},

    type: "all",

  });

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



  return (

    <div className="space-y-6">

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

        <div>

          <h2 className="text-2xl font-bold tracking-tight">Guild transactions</h2>

          <p className="text-sm text-muted-foreground">

            Record income and expenses, then confirm them before closing the books.

          </p>

        </div>

        {permissions.canManageTransactions && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)} className="rounded-full px-4">
              <PlusCircle className="mr-2 h-4 w-4" /> New transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add transaction</DialogTitle>
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
              <DialogTitle>Edit transaction</DialogTitle>
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



      <section className="grid gap-4 md:grid-cols-3">

        <Card>

          <CardHeader className="pb-2">

            <CardDescription>Period income</CardDescription>

            <CardTitle className="text-3xl font-bold">
              <WemixAmount
                value={summary.income}
                className="text-3xl font-bold"
                iconSize={24}
                iconClassName="h-6 w-6"
              />
            </CardTitle>

          </CardHeader>

        </Card>

        <Card>

          <CardHeader className="pb-2">

            <CardDescription>Period expense</CardDescription>

            <CardTitle className="text-3xl font-bold">
              <WemixAmount
                value={summary.expense}
                className="text-3xl font-bold"
                iconSize={24}
                iconClassName="h-6 w-6"
              />
            </CardTitle>

          </CardHeader>

        </Card>

        <Card>

          <CardHeader className="pb-2">

            <CardDescription>Net</CardDescription>

            <CardTitle className="text-3xl font-bold">
              <WemixAmount
                value={summary.income - summary.expense}
                className="text-3xl font-bold"
                iconSize={24}
                iconClassName="h-6 w-6"
              />
            </CardTitle>

          </CardHeader>

        </Card>

      </section>



      <Card>

        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <CardTitle>Transaction list</CardTitle>

            <CardDescription>Confirm transactions to include them in the closing balance.</CardDescription>

          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">

            <DateRangePicker

              value={filters.range}

              onChange={(range) => setFilters((prev) => ({ ...prev, range }))}

            />

            <Select

              value={filters.type ?? "all"}

              onValueChange={(value) =>

                setFilters((prev) => ({ ...prev, type: value as TransactionType | "all" }))

              }

            >

              <SelectTrigger className="w-[180px]">

                <SelectValue placeholder="All types" />

              </SelectTrigger>

              <SelectContent>

                <SelectItem value="all">All types</SelectItem>

                <SelectItem value="income">Income</SelectItem>

                <SelectItem value="expense">Expense</SelectItem>

                <SelectItem value="transfer">Transfer</SelectItem>

              </SelectContent>

            </Select>

            <Button

              variant="ghost"

              onClick={() => queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] })}

            >

              <RefreshCw className="mr-2 h-4 w-4" />

              Refresh

            </Button>

          </div>

        </CardHeader>

        <CardContent>

          {isLoading && (

            <div className="space-y-3">

              <Skeleton className="h-16 rounded-3xl" />

              <Skeleton className="h-16 rounded-3xl" />

              <Skeleton className="h-16 rounded-3xl" />

            </div>

          )}

          {!isLoading && transactions.length === 0 && (

            <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center">

              <p className="text-sm text-muted-foreground">

                No transactions in this period yet. Create one or adjust the filters.

              </p>

            </div>

          )}

          {!isLoading && transactions.length > 0 && (

            <div className="overflow-x-auto rounded-2xl border border-border/40">
              <Table>

              <TableHeader>

                <TableRow>

                  <TableHead>Date</TableHead>

                  <TableHead>Type & Category</TableHead>

                  <TableHead>Amount</TableHead>

                  <TableHead>Created by</TableHead>

                  <TableHead>Status</TableHead>

                  <TableHead>Actions</TableHead>

                </TableRow>

              </TableHeader>

              <TableBody>

                {transactions.map((tx) => (

                  <TableRow key={tx.id}>

                    <TableCell>{formatDateTime(tx.created_at)}</TableCell>

                    <TableCell>

                      <div className="flex flex-col">

                        <Badge

                          variant={

                            tx.tx_type === "income"

                              ? "success"

                              : tx.tx_type === "expense"

                                ? "destructive"

                                : "secondary"

                          }

                          className="w-fit"

                        >

                          {tx.tx_type}

                        </Badge>

                        <span className="text-sm font-medium">{tx.category}</span>

                      </div>

                    </TableCell>

                    <TableCell>
                      <WemixAmount value={tx.amount} />
                    </TableCell>

                    <TableCell>{tx.created_by_name ?? tx.created_by}</TableCell>

                    <TableCell>

                      <Badge variant={tx.confirmed ? "success" : "warning"}>

                        {tx.confirmed ? "Confirmed" : "Pending"}

                      </Badge>

                      {tx.evidence_path && (

                        <p className="text-xs text-muted-foreground">{tx.evidence_path}</p>

                      )}

                    </TableCell>

                    <TableCell>

                      {permissions.canManageTransactions ? (

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handleEditTransaction(tx)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit transaction</span>
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDeleteTransaction(tx)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete transaction</span>
                          </Button>

                          {!tx.confirmed && (

                            <Button

                              size="sm"

                              variant="ghost"

                              className="rounded-full"

                              disabled={confirmMutation.isPending}

                              onClick={() => confirmMutation.mutate(tx.id)}

                            >

                              <CheckCircle2 className="mr-2 h-4 w-4" />

                              Confirm

                            </Button>

                          )}

                        </div>

                      ) : (

                        <span className="text-xs text-muted-foreground">No actions</span>

                      )}

                    </TableCell>

                  </TableRow>

                ))}

              </TableBody>

              </Table>
            </div>

          )}

        </CardContent>

      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>Recent adds, edits, deletes, and confirmations.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
          )}
          {!historyQuery.isLoading && transactionHistory.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              No activity recorded yet.
            </div>
          )}
          {transactionHistory.length > 0 && (
            <div className="space-y-3">
              {transactionHistory.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-3xl border border-border/60 p-4"
                >
                  <div className="space-y-1 pr-4">
                    <p className="text-sm font-medium">{describeTransactionLog(log)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)} • {log.actor_name ?? "System"}
                    </p>
                  </div>
                  <Badge variant="outline" className="whitespace-nowrap">
                    {log.action.replace("TRANSACTION_", "").replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>

  );

}






