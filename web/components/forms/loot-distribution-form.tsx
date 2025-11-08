"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Member, LootDistribution } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { WemixAmount } from "@/components/wemix-amount";

interface LootDistributionFormProps {
  lootName: string;
  estimatedValue: number;
  members: Member[];
  onSubmit: (payload: LootDistribution[]) => Promise<void> | void;
  loading?: boolean;
}

export function LootDistributionForm({
  lootName,
  estimatedValue,
  members,
  onSubmit,
  loading,
}: LootDistributionFormProps) {
  const toast = useToast();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const totalShare = useMemo(() => {
    return Object.values(amounts).reduce((sum, value) => sum + Number(value || 0), 0);
  }, [amounts]);

  const handleSubmit = async () => {
    if (totalShare > estimatedValue) {
      toast({
        title: "Distribution exceeds value",
        description: "The total share is higher than the estimated loot value.",
      });
      return;
    }
    const payload = Object.entries(amounts)
      .map(([memberId, amount]) => ({
        member_id: memberId,
        share_amount: Number(amount),
      }))
      .filter((item) => item.share_amount > 0);

    if (payload.length === 0) {
      toast({
        title: "No members selected",
        description: "Set a share amount for at least one member.",
      });
      return;
    }

    await onSubmit(payload);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <p className="text-sm font-semibold text-foreground">{lootName}</p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>Estimated loot:</span>
          <WemixAmount value={estimatedValue} className="text-xs text-foreground" iconSize={12} iconClassName="h-3 w-3" />
          <span>· Total share:</span>
          <span className={totalShare > estimatedValue ? "text-destructive" : "text-secondary"}>
            <WemixAmount
              value={totalShare}
              className="text-xs"
              iconSize={12}
              iconClassName="h-3 w-3"
            />
          </span>
        </p>
      </div>
      <div className="grid max-h-[340px] gap-3 overflow-y-auto pr-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="rounded-2xl border border-border/40 bg-background/60 p-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{member.in_game_name}</p>
                <p className="text-xs text-muted-foreground">{member.role_in_guild}</p>
              </div>
              <div className="w-32">
                <Label className="text-xs text-muted-foreground">Share</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={amounts[member.id] ?? ""}
                  onChange={(event) =>
                    setAmounts((prev) => ({
                      ...prev,
                      [member.id]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button className="w-full" disabled={loading} onClick={handleSubmit}>
        {loading ? "Distributing…" : "Confirm distribution"}
      </Button>
    </div>
  );
}
