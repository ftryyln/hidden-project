"use client";

import { useState } from "react";
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
import { createLoot, distributeLoot, fetchLoot } from "@/lib/services/loot";
import { fetchMembers } from "@/lib/services/members";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import type { LootRecord, LootDistribution, Member } from "@/lib/types";
import { Gift, Sparkles } from "lucide-react";

export default function LootPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params.gid;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [selectedLoot, setSelectedLoot] = useState<LootRecord | null>(null);

  const lootQuery = useQuery({
    queryKey: ["guild", guildId, "loot"],
    queryFn: () => fetchLoot(guildId),
    enabled: Boolean(guildId),
  });

  const membersQuery = useQuery({
    queryKey: ["guild", guildId, "members", { for: "loot" }],
    queryFn: () =>
      fetchMembers(guildId, {
        active: true,
      }),
    enabled: distributeOpen,
  });

  const createMutation = useMutation({
    mutationFn: (payload: LootSchema) =>
      createLoot(guildId, {
        boss_name: payload.boss_name,
        item_name: payload.item_name,
        item_rarity: payload.item_rarity,
        estimated_value: payload.estimated_value,
        notes: payload.notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "loot"] });
      setCreateOpen(false);
      toast({
        title: "Loot recorded",
        description: "Distribute this loot to the appropriate members.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save loot",
        description: error.message,
      });
    },
  });

  const distributeMutation = useMutation({
    mutationFn: (payload: LootDistribution[]) => {
      if (!selectedLoot) throw new Error("Loot has not been selected");
      return distributeLoot(guildId, {
        loot_id: selectedLoot.id,
        distributions: payload,
      });
    },
    onSuccess: async () => {
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
    onError: (error) => {
      toast({
        title: "Distribution failed",
        description: error.message,
      });
    },
  });

  const lootItems = lootQuery.data?.loot ?? [];
  const isLoading = lootQuery.isLoading;

  const activeMembers: Member[] = membersQuery.data?.members ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Loot & distribution</h2>
          <p className="text-sm text-muted-foreground">
            Track raid drops and distribute loot with officer validation.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-4" onClick={() => setCreateOpen(true)}>
              <Gift className="mr-2 h-4 w-4" /> Record loot
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Loot list</CardTitle>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
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
                          {loot.boss_name} · {loot.item_rarity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(loot.estimated_value)}</TableCell>
                    <TableCell>
                      <Badge variant={loot.distributed ? "success" : "warning"}>
                        {loot.distributed ? "Distributed" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!loot.distributed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => {
                            setSelectedLoot(loot);
                            setDistributeOpen(true);
                          }}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Distribute
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
    </div>
  );
}
