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
import type { TransactionType } from "@/lib/types";

const schema = z.object({
  tx_type: z.enum(["income", "expense", "transfer"]),
  category: z.string().min(2, "Category is required"),
  amount: z.number().nonnegative("Amount cannot be negative"),
  description: z.string().max(500).optional(),
  evidence_path: z.string().optional(),
});

export type TransactionSchema = z.infer<typeof schema>;

interface TransactionFormProps {
  defaultValues?: Partial<TransactionSchema>;
  loading?: boolean;
  resetOnSubmit?: boolean;
  onSubmit: (values: TransactionSchema) => Promise<void> | void;
}

const baseDefaults: TransactionSchema = {
  tx_type: "income",
  category: "",
  amount: 0,
  description: "",
  evidence_path: "",
};

export function TransactionForm({
  defaultValues,
  loading,
  resetOnSubmit = true,
  onSubmit,
}: TransactionFormProps) {
  const form = useForm<TransactionSchema>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...baseDefaults,
      ...defaultValues,
    },
  });

  useEffect(() => {
    form.reset({
      ...baseDefaults,
      ...defaultValues,
    });
  }, [defaultValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    if (resetOnSubmit) {
      form.reset(baseDefaults);
    }
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label>Type</Label>
        <Select
          value={form.watch("tx_type")}
          onValueChange={(value) =>
            form.setValue("tx_type", value as TransactionType, { shouldDirty: true })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <Input id="category" placeholder="Guild Donation" {...form.register("category")} />
        {form.formState.errors.category && (
          <p className="text-xs text-destructive">
            {form.formState.errors.category.message}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label>Amount</Label>
        <CurrencyInput
          value={form.watch("amount")}
          onValueChange={(value) => form.setValue("amount", value, { shouldDirty: true })}
        />
        {form.formState.errors.amount && (
          <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...form.register("description")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="evidence_path">Evidence Path</Label>
        <Input
          id="evidence_path"
          placeholder="evidence/valhalla/2025/raid.png"
          {...form.register("evidence_path")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Save transaction"}
      </Button>
    </form>
  );
}
