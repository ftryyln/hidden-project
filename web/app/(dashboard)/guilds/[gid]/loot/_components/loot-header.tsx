"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { LootForm, type LootSchema } from "@/components/forms/loot-form";

interface LootHeaderProps {
  canManageLoot: boolean;
  createOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLoot: (values: LootSchema) => Promise<void> | void;
  creating: boolean;
}

export function LootHeader({ canManageLoot, createOpen, onOpenChange, onCreateLoot, creating }: LootHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Loot & Distribution</h2>
        <p className="text-sm text-muted-foreground">Track raid drops and distribute loot with officer validation.</p>
      </div>
      {canManageLoot && (
        <Dialog open={createOpen} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-4" onClick={() => onOpenChange(true)}>
              <Gift className="mr-2 h-4 w-4" /> Record Loot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New loot</DialogTitle>
            </DialogHeader>
            <LootForm
              loading={creating}
              onSubmit={async (values) => {
                await onCreateLoot(values);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
