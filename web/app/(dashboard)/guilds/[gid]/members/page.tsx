"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { MemberForm, type MemberSchema } from "@/components/forms/member-form";
import { listMembers, createMember, updateMember, toggleMemberStatus, type MemberListResponse } from "@/lib/api/members";

import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/format";
import type { AuditAction, GuildInvite, GuildRole, Member } from "@/lib/types";
import { toApiError } from "@/lib/api/errors";
import { createGuildAccess, createGuildInvite, fetchGuildAccess, fetchGuildAuditLogs, fetchGuildInvites, revokeGuildAccess, revokeGuildInvite, updateGuildAccess } from "@/lib/api/guild-access";
import type { CreateGuildAccessResponse } from "@/lib/api/guild-access";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { MembersSection, AccessControlSection, InviteLinksSection, AuditLogSection } from "./sections";
const membersQueryKey = (
  guildId: string,
  search: string,
  showInactive: boolean,
) => ["guild", guildId, "members", { search, showInactive }] as const;

const accessQueryKey = (guildId: string) =>
  ["guild", guildId, "access-control"] as const;

const invitesQueryKey = (guildId: string) =>
  ["guild", guildId, "invites"] as const;

const auditQueryKey = (guildId: string, filter: string) =>
  ["guild", guildId, "audit-logs", { filter }] as const;

const AUDIT_PAGE_SIZE = 50;

type AuditFilterKey = "all" | "transactions" | "roles" | "invites" | "loot" | "guild";

const AUDIT_FILTER_OPTIONS: Array<{ value: AuditFilterKey; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "transactions", label: "Transactions" },
  { value: "roles", label: "Role changes" },
  { value: "invites", label: "Invites" },
  { value: "loot", label: "Loot" },
  { value: "guild", label: "Guild updates" },
];

const AUDIT_FILTER_MAP: Record<AuditFilterKey, AuditAction[] | undefined> = {
  all: undefined,
  transactions: [
    "TRANSACTION_CREATED",
    "TRANSACTION_UPDATED",
    "TRANSACTION_DELETED",
    "TRANSACTION_CONFIRMED",
  ],
  roles: ["ROLE_ASSIGNED", "ROLE_REVOKED"],
  invites: ["INVITE_CREATED", "INVITE_REVOKED", "INVITE_ACCEPTED"],
  loot: ["LOOT_CREATED", "LOOT_UPDATED", "LOOT_DELETED", "LOOT_DISTRIBUTED"],
  guild: ["GUILD_CREATED", "GUILD_UPDATED", "GUILD_DELETED"],
};

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
  const [auditFilter, setAuditFilter] = useState<AuditFilterKey>("all");

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

  const auditFilterActions = AUDIT_FILTER_MAP[auditFilter];
  const auditQuery = useInfiniteQuery({
    queryKey: guildId ? auditQueryKey(guildId, auditFilter) : [],
    queryFn: async ({ pageParam }: { pageParam?: string }) =>
      fetchGuildAuditLogs(guildId!, {
        limit: AUDIT_PAGE_SIZE,
        cursor: pageParam,
        actions: auditFilterActions,
      }),
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

  const handleGrantAccess = useCallback(() => {
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
  }, [accessEmail, accessRole, createAccessMutation, toast]);

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

  const handleGenerateInvite = useCallback(() => {
    const trimmedEmail = inviteEmail.trim();
    const expiresAt =
      inviteTtlDays > 0
        ? new Date(Date.now() + inviteTtlDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    createInviteMutation.mutate({
      email: trimmedEmail.length > 0 ? trimmedEmail : undefined,
      role: inviteRole,
      expiresAt,
    });
  }, [createInviteMutation, inviteEmail, inviteRole, inviteTtlDays]);

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
        join_date: payload.join_date?.trim() ? payload.join_date : null,
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
        join_date: payload.join_date?.trim() ? payload.join_date : null,
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
      } catch {
        toast({
          title: "Copy failed",
          description: "Copy the value manually.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const statusBadgeVariant = useCallback((status: GuildInvite["status"]): "outline" | "secondary" | "destructive" => {
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
    <>
      <header className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage guild roster, profile information, and active states.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <MembersSection
          members={members}
          total={total}
          isLoading={isLoading}
          emptyState={emptyState}
          canManageMembers={canManageMembers}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          showInactive={showInactive}
          onToggleInactive={setShowInactive}
          onAddMember={() => {
            setSelectedMember(null);
            setDialogOpen(true);
          }}
          onEditMember={(member) => {
            setSelectedMember(member);
            setDialogOpen(true);
          }}
          onToggleMemberStatus={(member, nextState) => toggleMutation.mutate({ member, nextState })}
          isMutating={toggleMutation.isPending}
        />

        <AccessControlSection
          assignments={accessControl}
          isLoading={accessQuery.isLoading}
          canManageRoles={canManageRoles}
          accessEmail={accessEmail}
          onAccessEmailChange={setAccessEmail}
          accessRole={accessRole}
          onAccessRoleChange={setAccessRole}
          onGrantAccess={handleGrantAccess}
          granting={createAccessMutation.isPending}
          onAssignmentRoleChange={(userId, role) => updateAccessMutation.mutate({ userId, role })}
          onRevokeAccess={(userId) => revokeAccessMutation.mutate(userId)}
          disableRoleChange={(assignment) => assignment.role === "guild_admin" && adminCount <= 1}
          formatRelativeTime={formatRelativeTime}
        />

        <InviteLinksSection
          canManageInvites={canManageInvites}
          email={inviteEmail}
          onEmailChange={setInviteEmail}
          role={inviteRole}
          onRoleChange={setInviteRole}
          ttlDays={inviteTtlDays}
          onTtlChange={setInviteTtlDays}
          onGenerateInvite={handleGenerateInvite}
          generating={createInviteMutation.isPending}
          lastInviteInfo={lastInviteInfo}
          onCopyInvite={handleCopyInvite}
          invites={invites}
          isLoading={invitesLoading}
          onRevokeInvite={(inviteId) => revokeInviteMutation.mutate(inviteId)}
          statusBadgeVariant={statusBadgeVariant}
          formatRelativeTime={formatRelativeTime}
        />

        {canViewAudit && (
          <AuditLogSection
            logs={auditLogs}
            loading={auditLoading}
            onRefresh={() => auditQuery.refetch()}
            onLoadMore={auditQuery.hasNextPage ? () => auditQuery.fetchNextPage() : undefined}
            canLoadMore={auditQuery.hasNextPage}
            isFetchingMore={auditQuery.isFetchingNextPage}
            formatRelativeTime={formatRelativeTime}
            filterValue={auditFilter}
            onFilterChange={(value) => setAuditFilter(value as AuditFilterKey)}
            filterOptions={AUDIT_FILTER_OPTIONS}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
    </>
  );
}
