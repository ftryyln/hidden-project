"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LootForm, type LootSchema } from "@/components/forms/loot-form";
import type { LootRecord } from "@/lib/types";

interface LootEditDialogProps {
  open: boolean;
  loot: LootRecord | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LootSchema) => Promise<void> | void;
  loading: boolean;
}

export function LootEditDialog({ open, loot, onOpenChange, onSubmit, loading }: LootEditDialogProps) {
  if (!loot) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Loot</DialogTitle>
        </DialogHeader>
        <LootForm
          defaultValues={{
            boss_name: loot.boss_name,
            item_name: loot.item_name,
            item_rarity: loot.item_rarity,
            estimated_value: loot.estimated_value,
            notes: loot.notes ?? "",
          }}
          loading={loading}
          resetOnSubmit={false}
          onSubmit={async (values) => {
            await onSubmit(values);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
