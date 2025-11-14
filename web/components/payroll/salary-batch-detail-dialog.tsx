"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PayrollBatchDetail, PayrollMode, PayrollSource } from "@/lib/types";
import { WemixAmount } from "@/components/wemix-amount";

function modeLabel(mode: PayrollMode): string {
  switch (mode) {
    case "EQUAL":
      return "Split Evenly";
    case "PERCENTAGE":
      return "Percentage";
    case "FIXED":
      return "Fixed Amount";
    default:
      return mode;
  }
}

function sourceLabel(source: PayrollSource): string {
  return source === "TRANSACTION" ? "Transactions" : "Loot";
}

interface SalaryBatchDetailDialogProps {
  batch?: PayrollBatchDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
}

export function SalaryBatchDetailDialog({
  batch,
  open,
  onOpenChange,
  isLoading,
}: SalaryBatchDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Salary Distribution Detail</DialogTitle>
          <DialogDescription>
            Batch shared by {batch?.distributedByName ?? "-"} on{" "}
            {batch?.createdAt ? formatDateTime(batch.createdAt) : "-"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : batch ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="rounded-full">
                {sourceLabel(batch.source)}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {modeLabel(batch.mode)}
              </Badge>
              {batch.referenceCode && (
                <Badge variant="outline" className="rounded-full">
                  {batch.referenceCode}
                </Badge>
              )}
            </div>

            <div className="grid gap-4 rounded-lg border p-4 text-sm">
              <div className="grid gap-1">
              <span className="text-muted-foreground">Total Distributed</span>
                <span className="text-2xl font-semibold">
                  <WemixAmount value={batch.totalAmount} iconSize={20} />
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-muted-foreground">Balance Before → After</span>
                <span className="font-medium">
                  <WemixAmount value={batch.balanceBefore} iconSize={16} /> →{" "}
                  <WemixAmount value={batch.balanceAfter} iconSize={16} />
                </span>
              </div>
              {batch.periodFrom && batch.periodTo && (
                <div className="grid gap-1">
                  <span className="text-muted-foreground">Period</span>
                  <span className="font-medium">
                    {formatDate(batch.periodFrom)} – {formatDate(batch.periodTo)}
                  </span>
                </div>
              )}
              {batch.notes && (
                <div className="grid gap-1">
                  <span className="text-muted-foreground">Notes</span>
                  <p>{batch.notes}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.items.map((item) => (
                    <TableRow key={item.memberId}>
                      <TableCell>{item.memberName ?? "-"}</TableCell>
                      <TableCell>
                        {item.percentage !== null && item.percentage !== undefined
                          ? `${item.percentage.toFixed(2)}%`
                          : batch.mode === "EQUAL"
                            ? "Sama rata"
                            : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <WemixAmount value={item.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Batch tidak ditemukan.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
