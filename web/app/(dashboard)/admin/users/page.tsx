"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { UsersSkeleton } from "./_components/users-skeleton";
import { AssignGuildDialog } from "./_components/assign-guild-dialog";
import { UsersTable } from "./_components/users-table";
import {
  assignUserToGuild,
  deleteAdminUser,
  listAdminUsers,
  removeUserFromGuild,
  updateAdminUserRole,
} from "@/lib/api/admin-users";
import { listAdminGuilds } from "@/lib/api/admin";
import type { AdminUserSummary, GuildRole, UserRole } from "@/lib/types";
import { toApiError } from "@/lib/api/errors";
import { UserRoundX } from "lucide-react";

const appRoleOptions: Array<{ value: UserRole | "auto"; label: string }> = [
  { value: "super_admin", label: "Super Admin" },
  { value: "guild_admin", label: "Guild Admin" },
  { value: "officer", label: "Officer" },
  { value: "raider", label: "Raider" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
  { value: "auto", label: "Auto (derive from guild access)" },
];

export default function AdminUsersPage() {
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();

  const isSuperAdmin = user?.app_role === "super_admin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [status, isSuperAdmin, router]);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: listAdminUsers,
    enabled: status === "authenticated" && isSuperAdmin,
  });

  const guildsQuery = useQuery({
    queryKey: ["admin", "guilds"],
    queryFn: listAdminGuilds,
    enabled: status === "authenticated" && isSuperAdmin,
  });

  useEffect(() => {
    if (usersQuery.error) {
      toApiError(usersQuery.error).then((apiError) =>
        toast({
          title: "Failed to load users",
          description: apiError.message,
        }),
      );
    }
  }, [usersQuery.error, toast]);

  useEffect(() => {
    if (guildsQuery.error) {
      toApiError(guildsQuery.error).then((apiError) =>
        toast({
          title: "Failed to load guilds",
          description: apiError.message,
        }),
      );
    }
  }, [guildsQuery.error, toast]);

  const assignMutation = useMutation({
    mutationFn: ({ userId, guildId, role }: { userId: string; guildId: string; role: GuildRole }) =>
      assignUserToGuild(userId, { guild_id: guildId, role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "Guild access updated",
        description: "User permissions have been updated successfully.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Unable to assign user",
        description: apiError.message,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId, guildId }: { userId: string; guildId: string }) =>
      removeUserFromGuild(userId, guildId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "Access revoked",
        description: "User access to this guild has been removed.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Unable to revoke access",
        description: apiError.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "User removed",
        description: "The account has been deleted.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Unable to delete user",
        description: apiError.message,
      });
    },
  });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(null);
  const [pendingAppRoles, setPendingAppRoles] = useState<Record<string, UserRole | "auto" | null>>({});

  const handleOpenAssign = (target: AdminUserSummary) => {
    setSelectedUser(target);
    setAssignDialogOpen(true);
  };

  const handleAssign = async (userId: string, guildId: string, role: GuildRole) => {
    await assignMutation.mutateAsync({ userId, guildId, role });
  };

  const handleDeleteUser = (entry: AdminUserSummary) => {
    const isCurrentUser = entry.id === user?.id;
    if (isCurrentUser) {
      toast({
        title: "Cannot delete current user",
        description: "You cannot remove the account you are currently using.",
      });
      return;
    }
    if (
      window.confirm(
        `Delete ${entry.display_name ?? entry.email ?? "this user"}? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(entry.id);
    }
  };

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, appRole }: { userId: string; appRole: UserRole | null }) =>
      updateAdminUserRole(userId, appRole),
    onMutate: ({ userId, appRole }) => {
      setRoleUpdatingUserId(userId);
      setPendingAppRoles((prev) => ({
        ...prev,
        [userId]: appRole ?? "auto",
      }));
      return { userId };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({
        title: "User role updated",
        description: "Application access role has been updated.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Unable to update role",
        description: apiError.message,
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      setRoleUpdatingUserId(null);
      if (context?.userId) {
        setPendingAppRoles((prev) => {
          const next = { ...prev };
          delete next[context.userId];
          return next;
        });
      }
    },
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const guilds = useMemo(() => guildsQuery.data ?? [], [guildsQuery.data]);
  const [userSearch, setUserSearch] = useState("");

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aName = a.display_name ?? a.email ?? "";
      const bName = b.display_name ?? b.email ?? "";
      return aName.localeCompare(bName);
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return sortedUsers;
    return sortedUsers.filter((entry) => {
      const name = (entry.display_name ?? "").toLowerCase();
      const email = (entry.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [sortedUsers, userSearch]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <UserRoundX className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Invite, assign, or remove users across all guilds.</CardDescription>
          </div>
          <div className="w-full md:w-72">
            <Input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by name or email"
              className="rounded-full border-border/60 bg-background/60"
              aria-label="Search users"
            />
          </div>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <UsersSkeleton />
          ) : (
            <UsersTable
              users={filteredUsers}
              loading={usersQuery.isLoading}
              isSearchActive={Boolean(userSearch.trim())}
              guilds={guilds}
              appRoleOptions={appRoleOptions}
              pendingAppRoles={pendingAppRoles}
              roleUpdatingUserId={roleUpdatingUserId}
              currentUserId={user?.id}
              onOpenAssign={handleOpenAssign}
              onRemoveGuildAccess={(userId, guildId) => removeMutation.mutate({ userId, guildId })}
              removeAccessDisabled={removeMutation.isPending}
              onDeleteUser={handleDeleteUser}
              deleteDisabled={deleteMutation.isPending}
              onChangeAppRole={(userId, role) => updateRoleMutation.mutate({ userId, appRole: role })}
            />
          )}
        </CardContent>
      </Card>

      <AssignGuildDialog
        open={assignDialogOpen}
        onOpenChange={(next) => {
          setAssignDialogOpen(next);
          if (!next) {
            setSelectedUser(null);
          }
        }}
        user={selectedUser}
        guilds={guilds}
        onAssign={handleAssign}
        loading={assignMutation.isPending}
      />
    </div>
  );
}
