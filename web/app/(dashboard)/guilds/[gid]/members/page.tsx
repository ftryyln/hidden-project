"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { MemberForm, type MemberSchema } from "@/components/forms/member-form";
import { listMembers, createMember, updateMember, toggleMemberStatus, type MemberListResponse } from "@/lib/api/members";

import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/format";
import type { AuditLog, GuildInvite, GuildRole, GuildRoleAssignment, Member } from "@/lib/types";
import { Clipboard, Copy, Edit, Link, Mail, Power, RefreshCw, Search, Shield, Trash2, UserPlus } from "lucide-react";
import { toApiError } from "@/lib/api/errors";
import { createGuildAccess, createGuildInvite, fetchGuildAccess, fetchGuildAuditLogs, fetchGuildInvites, revokeGuildAccess, revokeGuildInvite, updateGuildAccess } from "@/lib/api/guild-access";
import type { CreateGuildAccessResponse } from "@/lib/api/guild-access";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
const membersQueryKey = (
  guildId: string,
  search: string,
  showInactive: boolean,
) => ["guild", guildId, "members", { search, showInactive }] as const;

const accessQueryKey = (guildId: string) =>
  ["guild", guildId, "access-control"] as const;

const invitesQueryKey = (guildId: string) =>
  ["guild", guildId, "invites"] as const;

const auditQueryKey = (guildId: string) =>
  ["guild", guildId, "audit-logs"] as const;

const ROLE_OPTIONS: { value: GuildRole; label: string }[] = [
  { value: "guild_admin", label: "Guild admin" },
  { value: "officer", label: "Officer" },
  { value: "raider", label: "Raider" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const INVITE_TTL_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

const AUDIT_PAGE_SIZE = 25;

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
  const { selectedGuild, changeGuild } = useDashboardGuild();

  useEffect(() => {
    if (guildId && guildId !== selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const guildRole = useMemo(
    () => deriveGuildRole(user ?? null, guildId),
    [user, guildId],
  );
  const permissions = useMemo(
    () => getGuildPermissions(guildRole),
    [guildRole],
  );

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRole, setAccessRole] = useState<GuildRole>("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<GuildRole>("member");
  const [inviteTtlDays, setInviteTtlDays] = useState<number>(7);
  const [lastInviteInfo, setLastInviteInfo] = useState<{
    email?: string | null;
    token?: string | null;
    url?: string | null;
  } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);
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
    enabled: Boolean(guildId),
  });

  const invitesQuery = useQuery({
    queryKey: guildId ? invitesQueryKey(guildId) : [],
    queryFn: async () => fetchGuildInvites(guildId!),
    enabled: Boolean(guildId && permissions.canManageInvites),
  });

  const auditQuery = useInfiniteQuery({
    queryKey: guildId ? auditQueryKey(guildId) : [],
    queryFn: async ({ pageParam }: { pageParam?: string }) =>
      fetchGuildAuditLogs(guildId!, { limit: AUDIT_PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < AUDIT_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at,
    enabled: Boolean(guildId && permissions.canViewAudit),
  });

  const invalidateMembers = useCallback(async () => {
    if (!guildId) return;
    await queryClient.invalidateQueries({
      queryKey: ["guild", guildId, "members"],
    });
  }, [guildId, queryClient]);
  const createAccessMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: GuildRole }) => {
      if (!guildId) {
        throw new Error("Guild context is missing");
      }
      return createGuildAccess(guildId, { email, role }) as Promise<CreateGuildAccessResponse>;
    },
    onSuccess: async (result) => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: accessQueryKey(guildId) });
      setAccessEmail("");
      setAccessRole("member");
      if (result.type === "assignment") {
        toast({
          title: "Access granted",
          description: "User can now access this guild.",
        });
      } else {
        await queryClient.invalidateQueries({ queryKey: invitesQueryKey(guildId) });
        setLastInviteInfo({
          email: result.invite.email ?? null,
          token: result.invite.token ?? null,
          url: result.invite.invite_url ?? null,
        });
        toast({
          title: "Invite created",
          description: result.invite.email
            ? `Invite ready for ${result.invite.email}`
            : "Open invite generated.",
        });
      }
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

  const updateAccessMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: GuildRole }) =>
      updateGuildAccess(guildId!, userId, role),
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

  const revokeAccessMutation = useMutation({
    mutationFn: async (userId: string) => revokeGuildAccess(guildId!, userId),
    onSuccess: async () => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: accessQueryKey(guildId) });
      toast({ title: "Access revoked" });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to revoke access", description: apiError.message, variant: "destructive" });
    },
  });
  const createInviteMutation = useMutation({
    mutationFn: async ({
      email,
      role,
      expiresAt,
    }: {
      email?: string;
      role: GuildRole;
      expiresAt?: string;
    }) => createGuildInvite(guildId!, { email, default_role: role, expires_at: expiresAt }),
    onSuccess: async (invite) => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: invitesQueryKey(guildId) });
      setInviteEmail("");
      setInviteRole("member");
      setLastInviteInfo({
        email: invite.email ?? null,
        token: invite.token ?? null,
        url: invite.invite_url ?? null,
      });
      toast({
        title: "Invite ready",
        description: invite.email ? `Invite ready for ${invite.email}` : "Open invite generated.",
      });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to create invite", description: apiError.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => revokeGuildInvite(guildId!, inviteId),
    onSuccess: async () => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: invitesQueryKey(guildId) });
      toast({ title: "Invite revoked" });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to revoke invite", description: apiError.message, variant: "destructive" });
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
  const accessControl = accessQuery.data ?? [];
  const adminCount = accessControl.filter((entry) => entry.role === "guild_admin").length;
  const invites = invitesQuery.data ?? [];
  const invitesLoading = invitesQuery.isLoading;
  const auditLogs = auditQuery.data?.pages.flat() ?? [];
  const auditLoading = auditQuery.isLoading;

  const canManageMembers = permissions.canManageMembers;
  const canManageRoles = permissions.canManageRoles;
  const canManageInvites = permissions.canManageInvites;
  const canViewAudit = permissions.canViewAudit;

  const formatRelativeTime = useCallback((iso: string | null | undefined) => {
    if (!iso) return "-";
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return formatDate(iso);
    }
  }, []);

  const handleCopyInvite = useCallback(
    async (value: string, subject: "link" | "token") => {
      if (!value) {
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: `Invite ${subject} copied` });
      } catch (copyError) {
        toast({
          title: "Copy failed",
          description: "Copy the value manually.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const statusBadgeVariant = useCallback((status: GuildInvite["status"]) => {
    switch (status) {
      case "pending":
        return "outline" as const;
      case "used":
        return "secondary" as const;
      case "revoked":
      case "expired":
      case "superseded":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage guild roster, profile information, and active states.
          </p>
        </div>

        {canManageMembers && (
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
                <DialogTitle>{selectedMember ? "Edit member" : "Add member"}</DialogTitle>
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

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Roster</CardTitle>
            <CardDescription>{total} members in total</CardDescription>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center rounded-full border border-border/60 bg-muted/20 px-3">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
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
              {canManageMembers && (
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
            <div className="overflow-x-auto rounded-2xl border border-border/40">
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
                        {canManageMembers ? (
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
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6">
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
          <CardContent className="space-y-4">
            {canManageRoles ? (
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
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
                    onValueChange={(value) => setAccessRole(value as GuildRole)}
                    disabled={createAccessMutation.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
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
                  {createAccessMutation.isPending ? "Granting..." : "Grant access"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can view access assignments but do not have permission to modify them.
              </p>
            )}

            {accessQuery.isLoading && (
              <div className="space-y-3">
                <Skeleton className="h-12 rounded-3xl" />
                <Skeleton className="h-12 rounded-3xl" />
              </div>
            )}

            {!accessQuery.isLoading && accessControl.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No authenticated users are linked to this guild yet. Invite users or promote them to grant access.
              </p>
            )}

            {!accessQuery.isLoading && accessControl.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-border/40">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessControl.map((assignment) => {
                    const isLastAdmin = assignment.role === "guild_admin" && adminCount <= 1;
                    return (
                      <TableRow key={assignment.user_id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {assignment.user?.display_name ?? assignment.user?.email ?? assignment.user_id}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {assignment.user?.email ?? "pending user"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={assignment.role}
                            onValueChange={(value) =>
                              updateAccessMutation.mutate({
                                userId: assignment.user_id,
                                role: value as GuildRole,
                              })
                            }
                            disabled={!canManageRoles || isLastAdmin || updateAccessMutation.isPending}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase">
                            {assignment.source ?? "manual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(assignment.assigned_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canManageRoles ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                aria-label="Revoke access"
                                variant="ghost"
                                size="icon"
                                disabled={isLastAdmin || revokeAccessMutation.isPending}
                                onClick={() => revokeAccessMutation.mutate(assignment.user_id)}
                              >
                                <Trash2 className="h-4 w-4" />
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Invite members</CardTitle>
            <CardDescription>Create invite links with default roles and expiry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManageInvites ? (
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-1">
                  <span className="text-sm font-semibold">Recipient email (optional)</span>
                  <Input
                    type="email"
                    placeholder="new-user@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    disabled={createInviteMutation.isPending}
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-semibold">Role</span>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as GuildRole)}
                    disabled={createInviteMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-semibold">Expires</span>
                  <Select
                    value={String(inviteTtlDays)}
                    onValueChange={(value) => setInviteTtlDays(Number(value))}
                    disabled={createInviteMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select expiry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITE_TTL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  disabled={createInviteMutation.isPending}
                  onClick={() => {
                    const email = inviteEmail.trim();
                    const expiresAt =
                      inviteTtlDays > 0
                        ? new Date(Date.now() + inviteTtlDays * 24 * 60 * 60 * 1000).toISOString()
                        : undefined;
                    createInviteMutation.mutate({
                      email: email.length > 0 ? email : undefined,
                      role: inviteRole,
                      expiresAt,
                    });
                  }}
                >
                  {createInviteMutation.isPending ? "Generating..." : "Generate invite"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You do not have permission to generate invites for this guild.
              </p>
            )}

            {lastInviteInfo && (lastInviteInfo.url || lastInviteInfo.token) && (
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <p className="text-sm font-semibold">
                  {lastInviteInfo.url ? "Latest invite link" : "Latest invite token"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lastInviteInfo.url
                    ? "Share this link with the invitee. It contains the one-time token and is only shown once."
                    : "Copy and share this token securely. It will only be displayed once."}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {lastInviteInfo.url && (
                    <div className="flex items-center gap-2">
                      <Input readOnly value={lastInviteInfo.url ?? ""} />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyInvite(lastInviteInfo.url ?? "", "link")}
                        aria-label="Copy invite link"
                      >
                        <Link className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {lastInviteInfo.token && (
                    <div className="flex items-center gap-2">
                      <Input readOnly value={lastInviteInfo.token ?? ""} />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyInvite(lastInviteInfo.token ?? "", "token")}
                        aria-label="Copy invite token"
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {invitesLoading && (
              <div className="space-y-2">
                <Skeleton className="h-12 rounded-2xl" />
                <Skeleton className="h-12 rounded-2xl" />
              </div>
            )}

            {!invitesLoading && invites.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-border/40">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {invite.email ? (
                            <>
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{invite.email}</span>
                            </>
                          ) : (
                            <>
                              <Link className="h-4 w-4 text-muted-foreground" />
                              <span>Open invite</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{invite.default_role}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeTime(invite.expires_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(invite.status)} className="uppercase">
                          {invite.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManageInvites && invite.status === "pending" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => revokeInviteMutation.mutate(invite.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No actions</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            )}

            {!invitesLoading && invites.length === 0 && (
              <p className="text-sm text-muted-foreground">No invites have been generated yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      {canViewAudit && (
        <Card className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>Track invite activity and access changes.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => auditQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {auditQuery.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => auditQuery.fetchNextPage()}
                  disabled={auditQuery.isFetchingNextPage}
                >
                  {auditQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLoading && (
              <div className="space-y-2">
                <Skeleton className="h-14 rounded-2xl" />
                <Skeleton className="h-14 rounded-2xl" />
              </div>
            )}

            {!auditLoading && auditLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            )}

            {!auditLoading &&
              auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold uppercase">{log.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-medium">{log.actor_name ?? "System"}</span>
                    <span className="text-muted-foreground">{"->"}</span>
                    <span>{log.target_name ?? "N/A"}</span>
                  </div>
                  {Object.keys(log.metadata ?? {}).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(log.metadata ?? {}).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                        >
                          {key}: {typeof value === "string" ? value : JSON.stringify(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
