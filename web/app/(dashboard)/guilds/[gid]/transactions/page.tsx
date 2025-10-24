"use client";

import { useMemo, useState } from "react";
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
  createTransaction,
  fetchTransactions,
  confirmTransaction,
} from "@/lib/services/transactions";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { TransactionType } from "@/lib/types";
import { DateRangePicker, type DateRange } from "@/components/forms/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, PlusCircle, RefreshCw } from "lucide-react";

export default function TransactionsPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params.gid;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<{
    range: DateRange;
    type?: TransactionType | "all";
  }>({
    range: {},
    type: "all",
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const transactionsQuery = useQuery({
    queryKey: ["guild", guildId, "transactions", filters],
    queryFn: () =>
      fetchTransactions(guildId, {
        from: filters.range.from,
        to: filters.range.to,
        type: filters.type && filters.type !== "all" ? filters.type : undefined,
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
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] });
      setDialogOpen(false);
      toast({
        title: "Transaction created",
        description: "Officers can confirm this transaction later.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save transaction",
        description: error.message,
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (transactionId: string) => confirmTransaction(guildId, transactionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] });
      toast({
        title: "Transaction confirmed",
        description: "The guild balance will include this transaction automatically.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to confirm transaction",
        description: error.message,
      });
    },
  });

  const transactions = transactionsQuery.data?.transactions ?? [];
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
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Period income</CardDescription>
            <CardTitle>{formatCurrency(summary.income)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Period expense</CardDescription>
            <CardTitle>{formatCurrency(summary.expense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net</CardDescription>
            <CardTitle>
              {formatCurrency(summary.income - summary.expense)}
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
                    <TableCell>{formatCurrency(tx.amount)}</TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
