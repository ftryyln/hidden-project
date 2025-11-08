"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { PlusCircle } from "lucide-react";
import { GuildForm, type GuildFormValues } from "./_components/guild-form";
import { GuildDirectoryTable } from "./_components/guild-directory-table";
import { GuildAdminsDialog } from "./_components/guild-admins-dialog";

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
          <h2 className="text-2xl font-bold tracking-tight">Super Admin Control</h2>
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
          <CardTitle>Guild Directory</CardTitle>
          <CardDescription>Full list of guilds managed inside the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <GuildDirectoryTable
            guilds={guildsQuery.data}
            loading={guildsQuery.isLoading}
            onEdit={(guild) => setEditingGuild(guild)}
            onManageAdmins={(guild) => {
              setAdminGuild(guild);
              setAdminsOpen(true);
            }}
            onDelete={handleDelete}
            deleteDisabled={deleteMutation.isPending}
          />
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

      <GuildAdminsDialog
        open={adminsOpen}
        onOpenChange={(open) => {
          setAdminsOpen(open);
          if (!open) {
            setAdminGuild(null);
            setAdminEmail("");
          }
        }}
        guild={adminGuild}
        adminEmail={adminEmail}
        onAdminEmailChange={setAdminEmail}
        onAssign={() => addAdminMutation.mutate()}
        assignDisabled={addAdminMutation.isPending || !adminGuild}
        admins={guildAdmins}
        isLoadingAdmins={adminsQuery.isLoading}
        onRemoveAdmin={(userId) => {
          if (!adminGuild) return;
          removeAdminMutation.mutate({ guildId: adminGuild.id, userId });
        }}
        removeDisabled={removeAdminMutation.isPending}
      />
    </div>
  );
}
