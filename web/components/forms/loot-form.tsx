"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/forms/currency-input";
import type { Rarity } from "@/lib/types";

const schema = z.object({
  boss_name: z.string().min(2, "Boss name is required"),
  item_name: z.string().min(2, "Item name is required"),
  item_rarity: z.enum(["common", "rare", "epic", "legendary", "mythic"]),
  estimated_value: z.number().nonnegative("Value must be positive"),
  notes: z.string().optional(),
});

export type LootSchema = z.infer<typeof schema>;

interface LootFormProps {
  defaultValues?: Partial<LootSchema>;
  onSubmit: (values: LootSchema) => Promise<void> | void;
  loading?: boolean;
  resetOnSubmit?: boolean;
}

const lootDefaults: LootSchema = {
  boss_name: "",
  item_name: "",
  item_rarity: "epic",
  estimated_value: 0,
  notes: "",
};

export function LootForm({
  defaultValues,
  onSubmit,
  loading,
  resetOnSubmit = true,
}: LootFormProps) {
  const form = useForm<LootSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...lootDefaults,
      ...defaultValues,
    },
  });

  useEffect(() => {
    form.reset({
      ...lootDefaults,
      ...defaultValues,
    });
  }, [defaultValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    if (resetOnSubmit) {
      form.reset(lootDefaults);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="boss_name">Boss</Label>
        <Input id="boss_name" {...form.register("boss_name")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="item_name">Item</Label>
        <Input id="item_name" {...form.register("item_name")} />
      </div>
      <div className="grid gap-2">
        <Label>Rarity</Label>
        <Select
          value={form.watch("item_rarity")}
          onValueChange={(value) =>
            form.setValue("item_rarity", value as Rarity, { shouldDirty: true })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="common">Common</SelectItem>
            <SelectItem value="rare">Rare</SelectItem>
            <SelectItem value="epic">Epic</SelectItem>
            <SelectItem value="legendary">Legendary</SelectItem>
            <SelectItem value="mythic">Mythic</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Estimated value</Label>
        <CurrencyInput
          value={form.watch("estimated_value")}
          onValueChange={(value) =>
            form.setValue("estimated_value", value, { shouldDirty: true })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Save loot"}
      </Button>
    </form>
  );
}
