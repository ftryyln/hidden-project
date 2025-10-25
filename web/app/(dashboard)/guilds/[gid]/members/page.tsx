"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { MemberForm, type MemberSchema } from "@/components/forms/member-form";

import {
  listMembers,
  createMember,
  updateMember,
  toggleMemberStatus,
  type MemberListResponse,
} from "@/lib/api/members";

import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/format";
import type { GuildRoleAssignment, Member } from "@/lib/types";
import { Edit, UserPlus, Power, Search, Shield } from "lucide-react";
import { toApiError } from "@/lib/api/errors";
import { fetchGuildAccess, updateGuildAccess, createGuildAccess } from "@/lib/api/guild-access";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";

// ------------------------------
// Helpers
// ------------------------------
const membersQueryKey = (
  guildId: string,
  search: string,
  showInactive: boolean
) => ["guild", guildId, "members", { search, showInactive }] as const;

const accessQueryKey = (guildId: string) =>
  ["guild", guildId, "access-control"] as const;

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function GuildMembersPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params?.gid;

  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const guildRole = useMemo(
    () => deriveGuildRole(user ?? null, guildId),
    [user, guildId]
  );
  const permissions = useMemo(
    () => getGuildPermissions(guildRole),
    [guildRole]
  );

  // UI state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRole, setAccessRole] = useState<GuildRoleAssignment["role"]>("member");

  // Debounce search input → search
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Queries
  const membersQuery = useQuery({
    queryKey: guildId ? membersQueryKey(guildId, search, showInactive) : [],
    queryFn: async (): Promise<MemberListResponse> =>
      listMembers(guildId!, {
        search: search || undefined,
        active: showInactive ? undefined : true,
      }),
    enabled: Boolean(guildId),
    staleTime: 5 * 1000,
  });

  const accessQuery = useQuery({
    queryKey: guildId ? accessQueryKey(guildId) : [],
    queryFn: async () => fetchGuildAccess(guildId!),
    enabled: Boolean(guildId) && permissions.canManageRoles,
  });

  // Mutations
  const invalidateMembers = useCallback(async () => {
    if (!guildId) return;
    await queryClient.invalidateQueries({
      queryKey: ["guild", guildId, "members"],
    });
  }, [guildId, queryClient]);

  const createAccessMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: GuildRoleAssignment["role"] }) => {
      if (!guildId) {
        throw new Error("Guild context is missing");
      }
      return createGuildAccess(guildId, {
        email,
        role,
      });
    },
    onSuccess: async () => {
      if (!guildId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "access-control"] });
      setAccessEmail("");
      setAccessRole("member");
      toast({
        title: "Access granted",
        description: "User can now access this guild.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({
        title: "Failed to grant access",
        description: apiError.message,
        variant: "destructive",
      });
    },
  });
  const accessMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: GuildRoleAssignment["role"];
    }) => updateGuildAccess(guildId!, userId, role),
    onSuccess: async () => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: accessQueryKey(guildId) });
      toast({ title: "Access role updated" });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to update access", description: apiError.message });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: MemberSchema) =>
      createMember(guildId!, {
        in_game_name: payload.in_game_name,
        role_in_guild: payload.role_in_guild,
        join_date: payload.join_date,
        notes: payload.notes,
        contact: payload.discord ? { discord: payload.discord } : {},
        is_active: payload.is_active,
      }),
    onSuccess: async () => {
      await invalidateMembers();
      toast({
        title: "Member added",
        description: "The guild roster has been updated.",
      });
      setDialogOpen(false);
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to add member", description: apiError.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: MemberSchema) => {
      if (!selectedMember) throw new Error("Member not selected");
      return updateMember(guildId!, selectedMember.id, {
        in_game_name: payload.in_game_name,
        role_in_guild: payload.role_in_guild,
        join_date: payload.join_date,
        notes: payload.notes,
        contact: payload.discord ? { discord: payload.discord } : {},
        is_active: payload.is_active,
      });
    },
    onSuccess: async () => {
      await invalidateMembers();
      toast({ title: "Member updated", description: "Member details have been saved." });
      setDialogOpen(false);
      setSelectedMember(null);
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to update member", description: apiError.message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      member,
      nextState,
    }: {
      member: Member;
      nextState: boolean;
    }) => toggleMemberStatus(guildId!, member.id, nextState),
    onSuccess: async () => {
      await invalidateMembers();
      toast({ title: "Member status updated" });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to update status", description: apiError.message });
    },
  });

  // Derived
  const members = membersQuery.data?.members ?? [];
  const total = membersQuery.data?.total ?? 0;

  const defaultValues = useMemo<MemberSchema | undefined>(() => {
    if (!selectedMember) return undefined;
    const contact = (selectedMember.contact ?? {}) as Record<string, unknown>;
    return {
      in_game_name: selectedMember.in_game_name,
      role_in_guild: selectedMember.role_in_guild,
      join_date: selectedMember.join_date ?? undefined,
      notes: selectedMember.notes ?? undefined,
      discord: typeof contact.discord === "string" ? (contact.discord as string) : "",
      is_active: selectedMember.is_active,
    };
  }, [selectedMember]);

  const isLoading = membersQuery.isLoading;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const emptyState = !isLoading && members.length === 0;
  const accessControl = permissions.canManageRoles ? accessQuery.data ?? [] : [];

  // ------------------------------
  // Render
  // ------------------------------
  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage guild roster, profile information, and active states.
          </p>
        </div>

        {permissions.canManageMembers && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="rounded-full"
                onClick={() => {
                  setSelectedMember(null);
                  setDialogOpen(true);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add member
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {selectedMember ? "Edit member" : "Add member"}
                </DialogTitle>
              </DialogHeader>

              <MemberForm
                defaultValues={defaultValues}
                onSubmit={async (values) => {
                  if (selectedMember) {
                    await updateMutation.mutateAsync(values);
                  } else {
                    await createMutation.mutateAsync(values);
                  }
                }}
                loading={isSaving}
                onCancel={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </header>

      {/* Roster card */}
      <Card className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Roster</CardTitle>
            <CardDescription>{total} members in total</CardDescription>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center rounded-full border border-border/60 bg-muted/20 px-3">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search members"
                className="border-0 bg-transparent focus-visible:ring-0"
              />
            </div>

            <Button
              variant={showInactive ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setShowInactive((prev) => !prev)}
            >
              {showInactive ? "Show active only" : "Show inactive members"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
            </div>
          )}

          {emptyState && (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No members yet</h3>
                <p className="text-sm text-muted-foreground">
                  Add guild members to start tracking your roster.
                </p>
              </div>
              {permissions.canManageMembers && (
                <Button
                  className="rounded-full"
                  onClick={() => {
                    setSelectedMember(null);
                    setDialogOpen(true);
                  }}
                >
                  Add member
                </Button>
              )}
            </div>
          )}

          {!isLoading && members.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {members.map((member) => {
                  const contact = (member.contact ?? {}) as Record<string, unknown>;
                  const discord =
                    typeof contact.discord === "string" && contact.discord.trim().length > 0
                      ? (contact.discord as string)
                      : "-";

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-sm font-semibold uppercase text-secondary-foreground">
                            {getInitials(member.in_game_name)}
                          </div>
                          <div>
                            <p className="font-semibold leading-tight">{member.in_game_name}</p>
                            <p className="text-xs text-muted-foreground">{discord}</p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{member.role_in_guild}</TableCell>
                      <TableCell>{formatDate(member.join_date ?? "")}</TableCell>

                      <TableCell>
                        <Badge variant={member.is_active ? "success" : "secondary"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        {permissions.canManageMembers ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label="Edit member"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedMember(member);
                                setDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              aria-label={member.is_active ? "Deactivate member" : "Activate member"}
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                toggleMutation.mutate({ member, nextState: !member.is_active })
                              }
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Access control card */}
      <Card className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Guild access control</CardTitle>
              <CardDescription>Promote members to manage guild resources.</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {permissions.canManageRoles && (
            <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
              <div className="grid gap-1">
                <span className="text-sm font-semibold">User email</span>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={accessEmail}
                  onChange={(event) => setAccessEmail(event.target.value)}
                  disabled={createAccessMutation.isPending}
                />
              </div>
              <div className="grid gap-1">
                <span className="text-sm font-semibold">Role</span>
                <Select
                  value={accessRole}
                  onValueChange={(value) =>
                    setAccessRole(value as GuildRoleAssignment["role"])
                  }
                >
                  <SelectTrigger className="w-full" disabled={createAccessMutation.isPending}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guild_admin">Guild admin</SelectItem>
                    <SelectItem value="officer">Officer</SelectItem>
                    <SelectItem value="raider">Raider</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="md:self-center"
                disabled={createAccessMutation.isPending}
                onClick={() => {
                  const email = accessEmail.trim();
                  if (!email) {
                    toast({
                      title: "Email required",
                      description: "Enter an email before granting access.",
                      variant: "destructive",
                    });
                    return;
                  }
                  createAccessMutation.mutate({ email, role: accessRole });
                }}
              >
                {createAccessMutation.isPending ? "Granting…" : "Grant access"}
              </Button>
            </div>
          )}

          {accessQuery.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-14 rounded-3xl" />
              <Skeleton className="h-14 rounded-3xl" />
            </div>
          )}

          {!accessQuery.isLoading && accessControl.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No authenticated users are linked to this guild yet. Invite users or promote them to grant access.
            </p>
          )}

          {!accessQuery.isLoading && accessControl.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {accessControl.map((access: GuildRoleAssignment) => (
                  <TableRow key={access.user_id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {access.user?.display_name ?? access.user?.email ?? access.user_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {access.user?.email ?? "—"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Select
                        value={access.role}
                        onValueChange={(value) =>
                          accessMutation.mutate({
                            userId: access.user_id,
                            role: value as GuildRoleAssignment["role"],
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="guild_admin">Guild admin</SelectItem>
                          <SelectItem value="officer">Officer</SelectItem>
                          <SelectItem value="raider">Raider</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-right">
                      {access.role === "guild_admin" && (
                        <Badge variant="success">Full access</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
