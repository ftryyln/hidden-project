"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  createAdminGuild,
  deleteAdminGuild,
  listAdminGuilds,
  updateAdminGuild,
} from "@/lib/api/admin";
import {
  createGuildAccess,
  fetchGuildAccess,
  revokeGuildAccess,
} from "@/lib/api/guild-access";
import type { AdminGuildSummary, GuildRoleAssignment } from "@/lib/types";
import { toApiError } from "@/lib/api/errors";
import { PlusCircle, Users, Shield, Pencil, Trash2, Crown } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(3, "Name is required").max(120),
  tag: z.string().min(2, "Tag is required").max(24),
  description: z.string().max(500).optional().nullable(),
});

type GuildFormValues = z.infer<typeof formSchema>;

function GuildForm({
  defaultValues,
  loading,
  onSubmit,
}: {
  defaultValues?: Partial<GuildFormValues>;
  loading?: boolean;
  onSubmit: (values: GuildFormValues) => Promise<unknown> | void;
}) {
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
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export default function AdminGuildsPage() {
  const { status, user } = useAuth();
  const isSuperAdmin = user?.app_role === "super_admin";
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingGuild, setEditingGuild] = useState<AdminGuildSummary | null>(null);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [adminGuild, setAdminGuild] = useState<AdminGuildSummary | null>(null);
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    if (status === "authenticated" && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [status, isSuperAdmin, router]);

  const guildsQuery = useQuery({
    queryKey: ["admin", "guilds"],
    queryFn: listAdminGuilds,
    enabled: Boolean(isSuperAdmin),
  });

  const adminsQuery = useQuery({
    queryKey: ["admin", adminGuild?.id, "admins"],
    queryFn: () => fetchGuildAccess(adminGuild!.id),
    enabled: adminsOpen && Boolean(adminGuild?.id),
  });

  const createMutation = useMutation({
    mutationFn: (values: GuildFormValues) => createAdminGuild(values),
    onSuccess: () => {
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "guilds"] }).catch(() => {});
      toast({
        title: "Guild created",
        description: "Assign at least one guild admin to activate it.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to create guild",
        description: apiError.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: GuildFormValues) => {
      if (!editingGuild) throw new Error("No guild selected");
      return updateAdminGuild(editingGuild.id, values);
    },
    onSuccess: () => {
      setEditingGuild(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "guilds"] }).catch(() => {});
      toast({
        title: "Guild updated",
        description: "Changes saved successfully.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to update guild",
        description: apiError.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (guildId: string) => deleteAdminGuild(guildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "guilds"] }).catch(() => {});
      toast({
        title: "Guild deleted",
        description: "All related data has been removed.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to delete guild",
        description: apiError.message,
        variant: "destructive",
      });
    },
  });

  const addAdminMutation = useMutation({
    mutationFn: async () => {
      if (!adminGuild) throw new Error("Guild not selected");
      const value = adminEmail.trim();
      if (!value) {
        throw new Error("Email or user ID is required");
      }
      const payload = value.includes("@")
        ? { email: value, role: "guild_admin" as const }
        : { user_id: value, role: "guild_admin" as const };
      await createGuildAccess(adminGuild.id, payload);
    },
    onSuccess: () => {
      setAdminEmail("");
      queryClient.invalidateQueries({
        queryKey: ["admin", adminGuild?.id, "admins"],
      }).catch(() => {});
      toast({
        title: "Guild admin added",
        description: "The user now has guild_admin access.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to add admin",
        description: apiError.message,
        variant: "destructive",
      });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: ({ guildId, userId }: { guildId: string; userId: string }) =>
      revokeGuildAccess(guildId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", adminGuild?.id, "admins"],
      }).catch(() => {});
      toast({
        title: "Guild admin removed",
        description: "Access revoked successfully.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to remove admin",
        description: apiError.message,
        variant: "destructive",
      });
    },
  });

  const guildAdmins: GuildRoleAssignment[] = useMemo(() => {
    if (!adminsQuery.data) return [];
    return adminsQuery.data.filter((assignment) => assignment.role === "guild_admin");
  }, [adminsQuery.data]);

  if (status === "loading" || !isSuperAdmin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const handleDelete = (guild: AdminGuildSummary) => {
    if (
      confirm(
        `Delete ${guild.name}? This will permanently remove all guild data and cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(guild.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Super admin control</h2>
          <p className="text-sm text-muted-foreground">
            Manage global guild records and ensure each guild has at least one admin.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-4" onClick={() => setCreateOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              New guild
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create guild</DialogTitle>
            </DialogHeader>
            <GuildForm
              loading={createMutation.isPending}
              onSubmit={async (values) => createMutation.mutateAsync(values)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guild directory</CardTitle>
          <CardDescription>Full list of guilds managed inside the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {guildsQuery.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          )}
          {!guildsQuery.isLoading && (guildsQuery.data?.length ?? 0) === 0 && (
            <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No guilds available yet. Create the first guild to get started.
              </p>
            </div>
          )}
          {!!(guildsQuery.data && guildsQuery.data.length > 0) && (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Guild admins</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guildsQuery.data?.map((guild) => (
                  <TableRow key={guild.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold">{guild.name}</span>
                        <span className="text-xs text-muted-foreground">{guild.tag}</span>
                        {guild.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {guild.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{guild.member_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>{guild.admin_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(guild.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => {
                            setAdminGuild(guild);
                            setAdminsOpen(true);
                          }}
                        >
                          <Crown className="h-4 w-4" />
                          <span className="sr-only">Manage admins</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => setEditingGuild(guild)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit guild</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(guild)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete guild</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingGuild)} onOpenChange={(open) => !open && setEditingGuild(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit guild</DialogTitle>
          </DialogHeader>
          {editingGuild && (
            <GuildForm
              defaultValues={{
                name: editingGuild.name,
                tag: editingGuild.tag,
                description: editingGuild.description ?? "",
              }}
              loading={updateMutation.isPending}
              onSubmit={async (values) => updateMutation.mutateAsync(values)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adminsOpen} onOpenChange={(open) => {
        setAdminsOpen(open);
        if (!open) {
          setAdminGuild(null);
          setAdminEmail("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guild admins</DialogTitle>
            <DialogDescription>
              Invite or assign users as guild_admin for {adminGuild?.name ?? "selected guild"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 p-4">
              <Label htmlFor="admin-email">Assign by email or user ID</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="admin-email"
                  placeholder="user@example.com or user id"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                />
                <Button
                  onClick={() => addAdminMutation.mutate()}
                  disabled={!adminEmail || addAdminMutation.isPending}
                >
                  Assign
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Existing users will be granted access immediately. New emails receive an invite.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Active admins
              </h4>
              {adminsQuery.isLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-10 rounded-2xl" />
                  <Skeleton className="h-10 rounded-2xl" />
                </div>
              )}
              {!adminsQuery.isLoading && guildAdmins.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No guild admins assigned yet.
                </div>
              )}
              {guildAdmins.map((assignment) => (
                <div
                  key={assignment.user_id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 p-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {assignment.user?.display_name ?? assignment.user?.email ?? assignment.user_id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Assigned at {new Date(assignment.assigned_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive"
                    disabled={removeAdminMutation.isPending}
                    onClick={() =>
                      removeAdminMutation.mutate({
                        guildId: adminGuild!.id,
                        userId: assignment.user_id,
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

