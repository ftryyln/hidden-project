"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { InviteLinksSection } from "../sections";
import { invitesQueryKey } from "../constants";
import { useToast } from "@/components/ui/use-toast";
import { createGuildInvite, fetchGuildInvites, revokeGuildInvite } from "@/lib/api/guild-access";
import { toApiError } from "@/lib/api/errors";
import type { GuildInvite, GuildRole } from "@/lib/types";
import { useRelativeTimeFormatter } from "../use-relative-time";

interface InviteLinksPanelProps {
  guildId?: string;
  canManageInvites: boolean;
  lastInviteInfo: { email?: string | null; token?: string | null; url?: string | null } | null;
  onLastInviteInfoChange: (info: { email?: string | null; token?: string | null; url?: string | null } | null) => void;
}

export function InviteLinksPanel({
  guildId,
  canManageInvites,
  lastInviteInfo,
  onLastInviteInfoChange,
}: InviteLinksPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { formatRelativeTime } = useRelativeTimeFormatter();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<GuildRole>("member");
  const [inviteTtlDays, setInviteTtlDays] = useState<number>(7);

  const invitesQuery = useQuery({
    queryKey: guildId ? invitesQueryKey(guildId) : [],
    queryFn: async () => fetchGuildInvites(guildId!),
    enabled: Boolean(guildId && canManageInvites),
  });

  const createInviteMutation = useMutation({
    mutationFn: async ({ email, role, expiresAt }: { email?: string; role: GuildRole; expiresAt?: string }) =>
      createGuildInvite(guildId!, { email, default_role: role, expires_at: expiresAt }),
    onSuccess: async (invite) => {
      if (!guildId) return;
      await queryClient.invalidateQueries({ queryKey: invitesQueryKey(guildId) });
      setInviteEmail("");
      setInviteRole("member");
      onLastInviteInfoChange({
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

  const statusBadgeVariant = (status: GuildInvite["status"]): "outline" | "secondary" | "destructive" => {
    switch (status) {
      case "pending":
        return "outline";
      case "used":
        return "secondary";
      case "revoked":
      case "expired":
      case "superseded":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleGenerateInvite = () => {
    const trimmedEmail = inviteEmail.trim();
    const expiresAt =
      inviteTtlDays > 0 ? new Date(Date.now() + inviteTtlDays * 24 * 60 * 60 * 1000).toISOString() : undefined;
    createInviteMutation.mutate({
      email: trimmedEmail.length > 0 ? trimmedEmail : undefined,
      role: inviteRole,
      expiresAt,
    });
  };

  const handleCopyInvite = async (value: string, subject: "link" | "token") => {
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
  };

  return (
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
      invites={invitesQuery.data ?? []}
      isLoading={invitesQuery.isLoading}
      onRevokeInvite={(inviteId) => revokeInviteMutation.mutate(inviteId)}
      statusBadgeVariant={statusBadgeVariant}
      formatRelativeTime={formatRelativeTime}
    />
  );
}
