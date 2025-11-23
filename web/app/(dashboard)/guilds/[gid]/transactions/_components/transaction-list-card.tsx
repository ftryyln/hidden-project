"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DateRangePicker, type DateRange } from "@/components/forms/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Transaction, TransactionType } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { WemixAmount } from "@/components/wemix-amount";
import { CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransactionFilters {
  range: DateRange;
  type?: TransactionType | "all";
}

interface TransactionListCardProps {
  filters: TransactionFilters;
  onRangeChange: (range: DateRange) => void;
  onTypeChange: (type: TransactionType | "all") => void;
  onRefresh: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  transactions: Transaction[];
  totalItems: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  filtersActive: boolean;
  isLoading: boolean;
  canManageTransactions: boolean;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onConfirm: (transactionId: string) => void;
  deleteDisabled: boolean;
  confirmDisabled: boolean;
}

export function TransactionListCard({
  filters,
  onRangeChange,
  onTypeChange,
  onRefresh,
  searchValue,
  onSearchChange,
  transactions,
  totalItems,
  page,
  totalPages,
  onPageChange,
  filtersActive,
  isLoading,
  canManageTransactions,
  onEdit,
  onDelete,
  onConfirm,
  deleteDisabled,
  confirmDisabled,
}: TransactionListCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Transaction List</CardTitle>
          <CardDescription>Confirm transactions to include them in the closing balance.</CardDescription>
        </div>

        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:self-end md:items-end">
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search transactions"
              className="rounded-full border-border/60 md:w-72"
              aria-label="Search transactions"
            />
            <Button variant="outline" onClick={onRefresh} className="rounded-full md:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
            <div className="w-full md:w-auto">
              <DateRangePicker value={filters.range} onChange={onRangeChange} />
            </div>
            <Select
              value={filters.type ?? "all"}
              onValueChange={(value) => onTypeChange(value as TransactionType | "all")}
            >
              <SelectTrigger className="w-full rounded-full md:w-[180px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              {filtersActive
                ? "No transactions match the current filters."
                : "No transactions in this period yet. Create one or adjust the filters."}
            </p>
          </div>
        )}

        {!isLoading && transactions.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type &amp; Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(tx.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
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
                        <span className="text-sm font-medium leading-tight whitespace-nowrap">
                          {tx.category}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <WemixAmount value={tx.amount} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {tx.created_by_name ?? tx.created_by}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.confirmed ? "success" : "warning"}>
                        {tx.confirmed ? "Confirmed" : "Pending"}
                      </Badge>
                      {tx.evidence_path && (
                        <p className="text-xs text-muted-foreground">{tx.evidence_path}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageTransactions ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            onClick={() => onEdit(tx)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit transaction</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                              "h-8 w-8 rounded-full text-destructive",
                              deleteDisabled && "opacity-50",
                            )}
                            disabled={deleteDisabled}
                            onClick={() => onDelete(tx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete transaction</span>
                          </Button>
                          {!tx.confirmed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full"
                              disabled={confirmDisabled}
                              onClick={() => onConfirm(tx.id)}
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

        {!isLoading && totalItems > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
