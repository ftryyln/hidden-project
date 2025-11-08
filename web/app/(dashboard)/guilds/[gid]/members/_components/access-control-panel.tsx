"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessControlSection } from "../sections";
import { accessQueryKey, invitesQueryKey } from "../constants";
import { useToast } from "@/components/ui/use-toast";
import {
  createGuildAccess,
  fetchGuildAccess,
  revokeGuildAccess,
  updateGuildAccess,
  type CreateGuildAccessResponse,
} from "@/lib/api/guild-access";
import { toApiError } from "@/lib/api/errors";
import type { GuildRole } from "@/lib/types";
import { useRelativeTimeFormatter } from "../use-relative-time";

interface AccessControlPanelProps {
  guildId?: string;
  canManageRoles: boolean;
  onInviteGenerated: (info: { email?: string | null; token?: string | null; url?: string | null }) => void;
}

export function AccessControlPanel({ guildId, canManageRoles, onInviteGenerated }: AccessControlPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { formatRelativeTime } = useRelativeTimeFormatter();
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRole, setAccessRole] = useState<GuildRole>("member");

  const accessQuery = useQuery({
    queryKey: guildId ? accessQueryKey(guildId) : [],
    queryFn: async () => fetchGuildAccess(guildId!),
    enabled: Boolean(guildId),
  });

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
        onInviteGenerated({
          email: result.invite.email ?? null,
          token: result.invite.token ?? null,
          url: result.invite.invite_url ?? null,
        });
        toast({
          title: "Invite created",
          description: result.invite.email ? `Invite ready for ${result.invite.email}` : "Open invite generated.",
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
    mutationFn: async ({ userId, role }: { userId: string; role: GuildRole }) => updateGuildAccess(guildId!, userId, role),
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

  const assignments = accessQuery.data ?? [];
  const adminCount = assignments.filter((entry) => entry.role === "guild_admin").length;

  return (
    <AccessControlSection
      assignments={assignments}
      isLoading={accessQuery.isLoading}
      canManageRoles={canManageRoles}
      accessEmail={accessEmail}
      onAccessEmailChange={setAccessEmail}
      accessRole={accessRole}
      onAccessRoleChange={setAccessRole}
      onGrantAccess={() => {
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
      granting={createAccessMutation.isPending}
      onAssignmentRoleChange={(userId, role) => updateAccessMutation.mutate({ userId, role })}
      onRevokeAccess={(userId) => revokeAccessMutation.mutate(userId)}
      disableRoleChange={(assignment) => assignment.role === "guild_admin" && adminCount <= 1}
      formatRelativeTime={formatRelativeTime}
    />
  );
}
