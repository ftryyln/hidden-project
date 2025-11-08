"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(3, "Name is required").max(120),
  tag: z.string().min(2, "Tag is required").max(24),
  description: z.string().max(500).optional().nullable(),
});

export type GuildFormValues = z.infer<typeof formSchema>;

interface GuildFormProps {
  defaultValues?: Partial<GuildFormValues>;
  loading?: boolean;
  onSubmit: (values: GuildFormValues) => Promise<unknown> | void;
}

export function GuildForm({ defaultValues, loading, onSubmit }: GuildFormProps) {
  const form = useForm<GuildFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      tag: "",
      description: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    form.reset({
      name: defaultValues?.name ?? "",
      tag: defaultValues?.tag ?? "",
      description: defaultValues?.description ?? "",
    });
  }, [defaultValues, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="tag">Tag</Label>
        <Input id="tag" {...form.register("tag")} />
        {form.formState.errors.tag && (
          <p className="text-xs text-destructive">{form.formState.errors.tag.message}</p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={3} {...form.register("description")} />
        {form.formState.errors.description && (
          <p className="text-xs text-destructive">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
