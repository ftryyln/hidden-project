"use client";

import { useEffect, useState } from "react";
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
import { LootForm, type LootSchema } from "@/components/forms/loot-form";
import { LootDistributionForm } from "@/components/forms/loot-distribution-form";
import { listLoot, createLoot, distributeLoot, updateLoot, deleteLoot } from "@/lib/api/loot";
import { listMembers } from "@/lib/api/members";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import type { LootRecord, LootDistribution, Member, AuditLog } from "@/lib/types";
import { Gift, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { toApiError } from "@/lib/api/errors";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { fetchGuildAuditLogs } from "@/lib/api/guild-access";
import { WemixAmount } from "@/components/wemix-amount";

const lootQueryKey = (guildId: string) => ["guild", guildId, "loot"] as const;
const lootMembersQueryKey = (guildId: string) => ["guild", guildId, "members", { for: "loot" }] as const;

function describeLootLog(log: AuditLog): string {
  const actor = log.actor_name ?? "Someone";
  const metadata = log.metadata ?? {};
  const itemName =
    typeof metadata.item_name === "string" && metadata.item_name.length > 0
      ? metadata.item_name
      : undefined;
  const bossName =
    typeof metadata.boss_name === "string" && metadata.boss_name.length > 0
      ? metadata.boss_name
      : undefined;
  const label = itemName ? itemName : "loot";
  const bossLabel = bossName ? ` from ${bossName}` : "";

  switch (log.action) {
    case "LOOT_CREATED":
      return `${actor} recorded ${label}${bossLabel}.`;
    case "LOOT_UPDATED":
      return `${actor} updated ${label}${bossLabel}.`;
    case "LOOT_DELETED":
      return `${actor} removed ${label}${bossLabel}.`;
    case "LOOT_DISTRIBUTED":
      return `${actor} distributed ${label}${bossLabel}.`;
    default:
      return `${actor} recorded loot activity.`;
  }
}

export default function LootPage() {
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


  const [createOpen, setCreateOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [selectedLoot, setSelectedLoot] = useState<LootRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [lootToEdit, setLootToEdit] = useState<LootRecord | null>(null);

  useEffect(() => {
    if (!permissions.canManageLoot) {
      setCreateOpen(false);
      setDistributeOpen(false);
      setSelectedLoot(null);
      setEditOpen(false);
      setLootToEdit(null);
    }
  }, [permissions.canManageLoot]);

  const lootQuery = useQuery({
    queryKey: guildId ? lootQueryKey(guildId) : [],
    queryFn: () => listLoot(guildId!),
    enabled: Boolean(guildId),
  });

  const membersQuery = useQuery({
    queryKey: guildId ? lootMembersQueryKey(guildId) : [],
    queryFn: async () =>
      listMembers(guildId!, {
        active: true,
        pageSize: 100,
      }),
    enabled: permissions.canManageLoot && distributeOpen && Boolean(guildId),
  });

  const historyQuery = useQuery({
    queryKey: ["guild", guildId, "loot", "history"],
    queryFn: () =>
      fetchGuildAuditLogs(guildId!, {
        actions: ["LOOT_CREATED", "LOOT_UPDATED", "LOOT_DELETED", "LOOT_DISTRIBUTED"],
        limit: 25,
      }),
    enabled: Boolean(guildId),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: LootSchema) =>
      createLoot(guildId!, {
        boss_name: payload.boss_name,
        item_name: payload.item_name,
        item_rarity: payload.item_rarity,
        estimated_value: payload.estimated_value,
        notes: payload.notes,
      }),
    onSuccess: async () => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: lootQueryKey(guildId) });
      setCreateOpen(false);
      toast({
        title: "Loot recorded",
        description: "Distribute this loot to the appropriate members.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to save loot",
        description: apiError.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: LootSchema) => {
      if (!lootToEdit) {
        throw new Error("Loot record not selected");
      }
      return updateLoot(guildId!, lootToEdit.id, {
        boss_name: payload.boss_name,
        item_name: payload.item_name,
        item_rarity: payload.item_rarity,
        estimated_value: payload.estimated_value,
        notes: payload.notes,
      });
    },
    onSuccess: async () => {
      if (!guildId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lootQueryKey(guildId) }),
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot", "history"] }),
      ]);
      setEditOpen(false);
      setLootToEdit(null);
      toast({
        title: "Loot updated",
        description: "Changes saved successfully.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to update loot",
        description: apiError.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (lootId: string) => deleteLoot(guildId!, lootId),
    onSuccess: async () => {
      if (!guildId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lootQueryKey(guildId) }),
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot", "history"] }),
      ]);
      toast({
        title: "Loot deleted",
        description: "The loot entry has been removed.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to delete loot",
        description: apiError.message,
      });
    },
  });

  const distributeMutation = useMutation({
    mutationFn: async (payload: LootDistribution[]) => {
      if (!selectedLoot) {
        throw new Error("Loot has not been selected");
      }
      return distributeLoot(guildId!, {
        loot_id: selectedLoot.id,
        distributions: payload,
      });
    },
    onSuccess: async () => {
      if (!guildId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lootQueryKey(guildId) }),
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "transactions"] }),
      ]);
      setDistributeOpen(false);
      setSelectedLoot(null);
      toast({
        title: "Distribution completed",
        description: "Member shares have been logged as pending expenses.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Distribution failed",
        description: apiError.message,
      });
    },
  });

  const handleEditLoot = (loot: LootRecord) => {
    setLootToEdit(loot);
    setEditOpen(true);
  };

  const handleDeleteLoot = (loot: LootRecord) => {
    if (deleteMutation.isPending || loot.distributed) {
      return;
    }
    const confirmed = window.confirm("Delete this loot entry? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(loot.id);
  };

  const lootItems = lootQuery.data?.loot ?? [];
  const lootHistory = historyQuery.data ?? [];
  const isLoading = lootQuery.isLoading;
  const activeMembers: Member[] = membersQuery.data?.members ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loot & Distribution</h2>
          <p className="text-sm text-muted-foreground">
            Track raid drops and distribute loot with officer validation.
          </p>
        </div>
        {permissions.canManageLoot && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-4" onClick={() => setCreateOpen(true)}>
                <Gift className="mr-2 h-4 w-4" /> Record Loot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New loot</DialogTitle>
              </DialogHeader>
              <LootForm
                loading={createMutation.isPending}
                onSubmit={async (values) => {
                  await createMutation.mutateAsync(values);
                }}
              />
            </DialogContent>
          </Dialog>
        )}

      {permissions.canManageLoot && lootToEdit && (
        <Dialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setLootToEdit(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Loot</DialogTitle>
            </DialogHeader>
            <LootForm
              defaultValues={{
                boss_name: lootToEdit.boss_name,
                item_name: lootToEdit.item_name,
                item_rarity: lootToEdit.item_rarity,
                estimated_value: lootToEdit.estimated_value,
                notes: lootToEdit.notes ?? "",
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

      <Card>
        <CardHeader>
          <CardTitle>Loot List</CardTitle>
          <CardDescription>Distribute loot as soon as the raid is done.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
            </div>
          )}
          {!isLoading && lootItems.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No loot has been recorded yet. Log the first drop from your latest raid.
              </p>
            </div>
          )}
          {!isLoading && lootItems.length > 0 && (
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
                      {permissions.canManageLoot ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full"
                            onClick={() => handleEditLoot(loot)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit loot</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-destructive"
                            disabled={deleteMutation.isPending || loot.distributed}
                            onClick={() => handleDeleteLoot(loot)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete loot</span>
                          </Button>
                          {!loot.distributed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="rounded-full"
                              disabled={distributeMutation.isPending}
                              onClick={() => {
                                setSelectedLoot(loot);
                                setDistributeOpen(true);
                              }}
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

      <Card>
        <CardHeader>
          <CardTitle>Loot History</CardTitle>
          <CardDescription>Audit log for loot entries and distributions.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
          )}
          {!historyQuery.isLoading && lootHistory.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              No loot history recorded yet.
            </div>
          )}
          {lootHistory.length > 0 && (
            <div className="space-y-3">
              {lootHistory.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between rounded-3xl border border-border/60 p-4"
                >
                  <div className="space-y-1 pr-4">
                    <p className="text-sm font-medium">{describeLootLog(log)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)} • {log.actor_name ?? "System"}
                    </p>
                  </div>
                  <Badge variant="outline" className="whitespace-nowrap">
                    {log.action.replace("LOOT_", "").replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {permissions.canManageLoot && (
        <Dialog open={distributeOpen} onOpenChange={setDistributeOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Loot distribution</DialogTitle>
            </DialogHeader>
            {selectedLoot && (
              <LootDistributionForm
                lootName={selectedLoot.item_name}
                estimatedValue={selectedLoot.estimated_value}
                members={activeMembers}
                loading={distributeMutation.isPending}
                onSubmit={async (payload) => {
                  await distributeMutation.mutateAsync(payload);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
