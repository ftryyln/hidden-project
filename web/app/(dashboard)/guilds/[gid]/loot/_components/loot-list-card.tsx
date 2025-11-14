"use client";

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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WemixAmount } from "@/components/wemix-amount";
import type { LootRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Pencil, Sparkles, Trash2 } from "lucide-react";

export type LootStatusFilter = "all" | "pending" | "distributed";

interface LootListCardProps {
  lootItems: LootRecord[];
  loading: boolean;
  canManageLoot: boolean;
  onEdit: (loot: LootRecord) => void;
  onDelete: (loot: LootRecord) => void;
  onDistribute: (loot: LootRecord) => void;
  deletePending: boolean;
  distributePending: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: LootStatusFilter;
  onStatusFilterChange: (value: LootStatusFilter) => void;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function LootListCard({
  lootItems,
  loading,
  canManageLoot,
  onEdit,
  onDelete,
  onDistribute,
  deletePending,
  distributePending,
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: LootListCardProps) {
  const filtersActive = searchValue.trim().length > 0 || statusFilter !== "all";
  const noResults = !loading && lootItems.length === 0;
  const safeTotalPages = Math.max(1, totalPages || 1);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Loot List</CardTitle>
          <CardDescription>Distribute loot as soon as the raid is done.</CardDescription>
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search loot"
            className="rounded-full border-border/60 lg:w-64"
            aria-label="Search loot records"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusFilterChange(value as LootStatusFilter)}
          >
            <SelectTrigger className="rounded-full border-border/60 lg:w-48">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending distribution</SelectItem>
              <SelectItem value="distributed">Distributed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
          </div>
        )}
        {noResults && (
          <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {filtersActive
                ? "No loot matches the current search or filters."
                : "No loot has been recorded yet. Log the first drop from your latest raid."}
            </p>
          </div>
        )}
        {!loading && lootItems.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lootItems.map((loot) => (
                  <TableRow key={loot.id}>
                    <TableCell>{formatDateTime(loot.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{loot.item_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {loot.boss_name} / {loot.item_rarity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <WemixAmount value={loot.estimated_value} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={loot.distributed ? "success" : "warning"}>
                        {loot.distributed ? "Distributed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageLoot ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            onClick={() => onEdit(loot)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit loot</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-destructive"
                            disabled={deletePending || loot.distributed}
                            onClick={() => onDelete(loot)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete loot</span>
                          </Button>
                          {!loot.distributed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full"
                              disabled={distributePending}
                              onClick={() => onDistribute(loot)}
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              Distribute
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
        {!loading && totalItems > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Page {page} of {safeTotalPages} · {totalItems} total drops
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
                disabled={page >= safeTotalPages}
                onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
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
