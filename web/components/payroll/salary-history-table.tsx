"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { PayrollBatchListItem, PayrollSource } from "@/lib/types";
import { WemixAmount } from "@/components/wemix-amount";

function sourceLabel(source: PayrollSource): string {
  return source === "TRANSACTION" ? "Transactions" : "Loot";
}

interface SalaryHistoryTableProps {
  data: PayrollBatchListItem[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectBatch: (batchId: string) => void;
  actionsDisabled?: boolean;
}

export function SalaryHistoryTable({
  data,
  isLoading,
  page,
  totalPages,
  onPageChange,
  onSelectBatch,
  actionsDisabled,
}: SalaryHistoryTableProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/40 bg-card/80 p-4">
        <div>
          <h3 className="text-lg font-semibold">Salary Distribution History</h3>
          <p className="text-sm text-muted-foreground">
            Review previous payroll batches. Open details to inspect each allocation.
          </p>
        </div>
      <div className="rounded-2xl border border-border/30 bg-background/40 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
            <TableHead className="whitespace-nowrap">Date / Period</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Total</TableHead>
            <TableHead className="whitespace-nowrap">Members</TableHead>
            <TableHead className="min-w-[120px] whitespace-nowrap">Distributed By</TableHead>
            <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No salary distribution for this source yet.
                    </TableCell>
                  </TableRow>
                  )
                : data.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold whitespace-nowrap">
                            {formatDate(batch.createdAt)}
                          </span>
                          {batch.periodFrom && batch.periodTo && (
                            <span className="whitespace-nowrap text-xs text-muted-foreground">
                              ({formatDate(batch.periodFrom)} → {formatDate(batch.periodTo)})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {sourceLabel(batch.source)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        <WemixAmount value={batch.totalAmount} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{batch.membersCount} member{batch.membersCount === 1 ? "" : "s"}</TableCell>
                      <TableCell className="whitespace-nowrap">{batch.distributedByName}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionsDisabled}
                          onClick={() => onSelectBatch(batch.id)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Page {page} of {Math.max(totalPages, 1)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
