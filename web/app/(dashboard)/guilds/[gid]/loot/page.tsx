"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import type { LootRecord, LootDistribution, Member } from "@/lib/types";
import { listLoot, createLoot, distributeLoot, updateLoot, deleteLoot } from "@/lib/api/loot";
import { listMembers } from "@/lib/api/members";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { toApiError } from "@/lib/api/errors";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { fetchGuildAuditLogs } from "@/lib/api/guild-access";
import { LootHeader } from "./_components/loot-header";
import { LootEditDialog } from "./_components/loot-edit-dialog";
import { LootListCard, type LootStatusFilter } from "./_components/loot-list-card";
import { LootHistoryCard } from "./_components/loot-history-card";
import { LootDistributionDialog } from "./_components/loot-distribution-dialog";
import type { LootSchema } from "@/components/forms/loot-form";

type LootQueryFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: "distributed" | "pending";
};

const lootQueryKey = (guildId: string, filters: LootQueryFilters) =>
  ["guild", guildId, "loot", filters] as const;
const lootMembersQueryKey = (guildId: string) => ["guild", guildId, "members", { for: "loot" }] as const;
const LOOT_PAGE_SIZE = 10;

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LootStatusFilter>("all");
  const [page, setPage] = useState(1);

  const normalizedFilters = useMemo<LootQueryFilters>(() => {
    const trimmedSearch = search.trim();
    return {
      page,
      pageSize: LOOT_PAGE_SIZE,
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    };
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!permissions.canManageLoot) {
      setCreateOpen(false);
      setDistributeOpen(false);
      setSelectedLoot(null);
      setEditOpen(false);
      setLootToEdit(null);
    }
  }, [permissions.canManageLoot]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const lootQuery = useQuery({
    queryKey: guildId ? lootQueryKey(guildId, normalizedFilters) : [],
    queryFn: () => listLoot(guildId!, normalizedFilters),
    enabled: Boolean(guildId),
    placeholderData: keepPreviousData,
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
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot"] });
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
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot"] }),
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
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot"] }),
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
        queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot"] }),
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
  const totalItems = lootQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / LOOT_PAGE_SIZE));

  useEffect(() => {
    if (!lootQuery.data) {
      return;
    }
    setPage((prev) => Math.min(prev, totalPages));
  }, [lootQuery.data, totalPages]);
  const lootHistory = historyQuery.data ?? [];
  const isLoading = lootQuery.isLoading;
  const activeMembers: Member[] = membersQuery.data?.members ?? [];

  return (
    <div className="space-y-6">
      <LootHeader
        canManageLoot={permissions.canManageLoot}
        createOpen={createOpen}
        onOpenChange={setCreateOpen}
        onCreateLoot={async (values) => {
          await createMutation.mutateAsync(values);
        }}
        creating={createMutation.isPending}
      />

      <LootEditDialog
        open={editOpen && Boolean(lootToEdit)}
        loot={lootToEdit}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setLootToEdit(null);
          }
        }}
        loading={updateMutation.isPending}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync(values);
        }}
      />

      <LootListCard
        lootItems={lootItems}
        loading={isLoading}
        canManageLoot={permissions.canManageLoot}
        onEdit={handleEditLoot}
        onDelete={handleDeleteLoot}
        onDistribute={(loot) => {
          setSelectedLoot(loot);
          setDistributeOpen(true);
        }}
        deletePending={deleteMutation.isPending}
        distributePending={distributeMutation.isPending}
        searchValue={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={setPage}
      />

      <LootHistoryCard logs={lootHistory} loading={historyQuery.isLoading} />

      <LootDistributionDialog
        open={distributeOpen}
        onOpenChange={(open) => {
          setDistributeOpen(open);
          if (!open) {
            setSelectedLoot(null);
          }
        }}
        loot={selectedLoot}
        members={activeMembers}
        loading={distributeMutation.isPending}
        canManageLoot={permissions.canManageLoot}
        onSubmit={async (payload) => {
          await distributeMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
