"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  assignUserToGuild,
  deleteAdminUser,
  listAdminUsers,
  removeUserFromGuild,
} from "@/lib/api/admin-users";
import { listAdminGuilds } from "@/lib/api/admin";
import type { AdminGuildSummary, AdminUserSummary, GuildRole } from "@/lib/types";
import { toApiError } from "@/lib/api/errors";
import { Trash2, UserRoundX, PlusCircle, X } from "lucide-react";

const roleOptions: Array<{ value: GuildRole; label: string }> = [
  { value: "guild_admin", label: "Guild Admin" },
  { value: "officer", label: "Officer" },
  { value: "raider", label: "Raider" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

function UsersSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="grid grid-cols-[2fr,1fr,2fr,1fr] items-center gap-4 rounded-xl border border-border/50 p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-40 rounded-full" />
          <div className="flex justify-end gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface AssignDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  user: AdminUserSummary | null;
  guilds: AdminGuildSummary[];
  onAssign: (userId: string, guildId: string, role: GuildRole) => Promise<void>;
  loading: boolean;
}

function AssignGuildDialog({ open, onOpenChange, user, guilds, onAssign, loading }: AssignDialogProps) {
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<GuildRole>("member");
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setSelectedGuild(guilds[0]?.id ?? "");
      setSelectedRole("member");
    }
  }, [open, guilds]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      onOpenChange(false);
      return;
    }
    if (!selectedGuild) {
      toast({
        title: "Select a guild",
        description: "Choose a guild before assigning the user.",
      });
      return;
    }
    await onAssign(user.id, selectedGuild, selectedRole);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign user to guild</DialogTitle>
          <DialogDescription>
            Pick a guild and role to grant access for {user?.display_name ?? user?.email ?? "this user"}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="guild">Guild</Label>
            <Select value={selectedGuild} onValueChange={setSelectedGuild}>
              <SelectTrigger id="guild">
                <SelectValue placeholder="Select guild" />
              </SelectTrigger>
              <SelectContent>
                {guilds.map((guild) => (
                  <SelectItem key={guild.id} value={guild.id}>
                    {guild.name} ({guild.tag})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as GuildRole)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || guilds.length === 0}>
              {loading ? "Assigning…" : "Assign user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
    onSuccess: async (_data, variables) => {
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

  const handleOpenAssign = (target: AdminUserSummary) => {
    setSelectedUser(target);
    setAssignDialogOpen(true);
  };

  const handleAssign = async (userId: string, guildId: string, role: GuildRole) => {
    await assignMutation.mutateAsync({ userId, guildId, role });
  };

  const users = usersQuery.data ?? [];
  const guilds = guildsQuery.data ?? [];

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aName = a.display_name ?? a.email ?? "";
      const bName = b.display_name ?? b.email ?? "";
      return aName.localeCompare(bName);
    });
  }, [users]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <UserRoundX className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>Invite, assign, or remove users across all guilds.</CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <UsersSkeleton />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Guild access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No users found. Invite members or have them register to manage access here.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.map((entry) => {
                      const isCurrentUser = entry.id === user?.id;
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{entry.display_name ?? "Unnamed user"}</p>
                              <p className="text-xs text-muted-foreground">{entry.email ?? "Email unavailable"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={entry.app_role === "super_admin" ? "secondary" : "outline"}>
                              {entry.app_role ?? "unassigned"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              {entry.guilds.length === 0 && (
                                <span className="text-xs text-muted-foreground">No guild access</span>
                              )}
                              {entry.guilds.map((assignment) => (
                                <div
                                  key={`${entry.id}-${assignment.guild_id}`}
                                  className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs"
                                >
                                  <span className="font-semibold">{assignment.guild_tag}</span>
                                  <span className="capitalize text-muted-foreground">{assignment.role}</span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive"
                                    disabled={removeMutation.isPending}
                                    onClick={() =>
                                      removeMutation.mutate({ userId: entry.id, guildId: assignment.guild_id })
                                    }
                                  >
                                    <span className="sr-only">Remove access</span>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAssign(entry)}
                                disabled={guilds.length === 0}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deleteMutation.isPending || isCurrentUser}
                                onClick={() => {
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
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
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
