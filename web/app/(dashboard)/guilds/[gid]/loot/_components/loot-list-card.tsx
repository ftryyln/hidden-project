"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WemixAmount } from "@/components/wemix-amount";
import type { LootRecord } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Pencil, Sparkles, Trash2 } from "lucide-react";

interface LootListCardProps {
  lootItems: LootRecord[];
  loading: boolean;
  canManageLoot: boolean;
  onEdit: (loot: LootRecord) => void;
  onDelete: (loot: LootRecord) => void;
  onDistribute: (loot: LootRecord) => void;
  deletePending: boolean;
  distributePending: boolean;
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
}: LootListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loot List</CardTitle>
        <CardDescription>Distribute loot as soon as the raid is done.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
          </div>
        )}
        {!loading && lootItems.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No loot has been recorded yet. Log the first drop from your latest raid.
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
                          {loot.boss_name} • {loot.item_rarity}
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
      </CardContent>
    </Card>
  );
}
