"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LootDistributionForm } from "@/components/forms/loot-distribution-form";
import type { LootDistribution, LootRecord, Member } from "@/lib/types";

interface LootDistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loot: LootRecord | null;
  members: Member[];
  loading: boolean;
  canManageLoot: boolean;
  onSubmit: (distribution: LootDistribution[]) => Promise<void> | void;
}

export function LootDistributionDialog({
  open,
  onOpenChange,
  loot,
  members,
  loading,
  canManageLoot,
  onSubmit,
}: LootDistributionDialogProps) {
  if (!canManageLoot) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Loot distribution</DialogTitle>
        </DialogHeader>
        {loot && (
          <LootDistributionForm
            lootName={loot.item_name}
            estimatedValue={loot.estimated_value}
            members={members}
            loading={loading}
            onSubmit={async (payload) => {
              await onSubmit(payload);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
