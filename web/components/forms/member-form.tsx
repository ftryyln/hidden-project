"use client";

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
import type { MemberRole } from "@/lib/types";
import { Switch } from "@/components/ui/switch";

const memberSchema = z.object({
  in_game_name: z.string().min(2, "Name must be at least 2 characters"),
  role_in_guild: z.custom<MemberRole>(),
  join_date: z.string().optional(),
  discord: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type MemberSchema = z.infer<typeof memberSchema>;

interface MemberFormProps {
  defaultValues?: Partial<MemberSchema>;
  loading?: boolean;
  submitLabel?: string;
  onSubmit: (values: MemberSchema) => Promise<void> | void;
}

export function MemberForm({
  defaultValues,
  loading,
  submitLabel = "Save",
  onSubmit,
}: MemberFormProps) {
  const form = useForm<MemberSchema>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      in_game_name: "",
      role_in_guild: "raider",
      join_date: "",
      discord: "",
      notes: "",
      is_active: true,
      ...defaultValues,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="in_game_name">Character name</Label>
        <Input id="in_game_name" {...form.register("in_game_name")} />
        {form.formState.errors.in_game_name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.in_game_name.message}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label>Guild role</Label>
        <Select
          defaultValue={form.getValues("role_in_guild")}
          onValueChange={(value) =>
            form.setValue("role_in_guild", value as MemberRole, { shouldDirty: true })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="leader">Leader</SelectItem>
            <SelectItem value="officer">Officer</SelectItem>
            <SelectItem value="raider">Raider</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="join_date">Join date</Label>
        <Input id="join_date" type="date" {...form.register("join_date")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="discord">Discord</Label>
        <Input id="discord" placeholder="ayla#1234" {...form.register("discord")} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/20 px-3 py-2">
        <div>
          <Label className="text-sm font-semibold">Active status</Label>
          <p className="text-xs text-muted-foreground">
            Turn off when a member is on an extended break.
          </p>
        </div>
        <Switch
          checked={form.watch("is_active")}
          onCheckedChange={(checked) => form.setValue("is_active", checked, { shouldDirty: true })}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
