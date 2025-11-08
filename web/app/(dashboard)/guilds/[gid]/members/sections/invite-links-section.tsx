"use client";

import { Clipboard, Link, Mail, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/responsive/section-card";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/responsive/responsive-table";
import { ActionMenu } from "@/components/responsive/action-menu";
import type { GuildInvite, GuildRole } from "@/lib/types";

import { INVITE_TTL_OPTIONS, ROLE_OPTIONS } from "./constants";

interface InviteLinksSectionProps {
  canManageInvites: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  role: GuildRole;
  onRoleChange: (role: GuildRole) => void;
  ttlDays: number;
  onTtlChange: (days: number) => void;
  onGenerateInvite: () => void;
  generating: boolean;
  lastInviteInfo: { email?: string | null; token?: string | null; url?: string | null } | null;
  onCopyInvite: (value: string, subject: "link" | "token") => void;
  invites: GuildInvite[];
  isLoading: boolean;
  onRevokeInvite: (inviteId: string) => void;
  statusBadgeVariant: (status: GuildInvite["status"]) => "outline" | "secondary" | "destructive";
  formatRelativeTime: (iso: string | null | undefined) => string;
}

export function InviteLinksSection({
  canManageInvites,
  email,
  onEmailChange,
  role,
  onRoleChange,
  ttlDays,
  onTtlChange,
  onGenerateInvite,
  generating,
  lastInviteInfo,
  onCopyInvite,
  invites,
  isLoading,
  onRevokeInvite,
  statusBadgeVariant,
  formatRelativeTime,
}: InviteLinksSectionProps) {
  const inviteColumns: ResponsiveTableColumn<GuildInvite>[] = [
    {
      header: "Recipient",
      cell: (invite) => (
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
      ),
    },
    {
      header: "Role",
      cell: (invite) => invite.default_role,
      stackedLabel: "Role",
    },
    {
      header: "Expires",
      cell: (invite) => (
        <span className="text-sm text-muted-foreground">{formatRelativeTime(invite.expires_at)}</span>
      ),
      stackedLabel: "Expires",
    },
    {
      header: "Status",
      cell: (invite) => (
        <Badge variant={statusBadgeVariant(invite.status)} className="uppercase">
          {invite.status}
        </Badge>
      ),
      stackedLabel: "Status",
    },
    {
      header: "Actions",
      hideOnMobile: true,
      cell: (invite) =>
        canManageInvites && invite.status === "pending" ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRevokeInvite(invite.id)}
              aria-label="Revoke invite"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No actions</span>
        ),
    },
  ];

  return (
    <SectionCard
      title="Invite members"
      description="Create invite links with default roles and expiry."
      icon={<Link className="h-5 w-5" />}
    >
      <div className="space-y-4">
        {canManageInvites ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-1">
              <span className="text-sm font-semibold">Recipient email (optional)</span>
              <Input
                type="email"
                placeholder="new-user@example.com"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                disabled={generating}
              />
            </div>
            <div className="grid gap-1">
              <span className="text-sm font-semibold">Role</span>
              <Select
                value={role}
                onValueChange={(value) => onRoleChange(value as GuildRole)}
                disabled={generating}
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
                value={String(ttlDays)}
                onValueChange={(value) => onTtlChange(Number(value))}
                disabled={generating}
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
            <Button type="button" disabled={generating} onClick={onGenerateInvite}>
              {generating ? "Generating..." : "Generate invite"}
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
                    onClick={() => onCopyInvite(lastInviteInfo.url ?? "", "link")}
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
                    onClick={() => onCopyInvite(lastInviteInfo.token ?? "", "token")}
                    aria-label="Copy invite token"
                  >
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-2xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        )}

        {!isLoading && invites.length > 0 && (
          <ResponsiveTable
            columns={inviteColumns}
            data={invites}
            getRowId={(row) => row.id}
            emptyMessage="No invites yet."
            renderMobileRowExtras={(invite) =>
              canManageInvites && invite.status === "pending" ? (
                <ActionMenu
                  ariaLabel={`Invite actions for ${invite.email ?? "open invite"}`}
                  items={[
                    {
                      label: "Revoke invite",
                      destructive: true,
                      onSelect: () => onRevokeInvite(invite.id),
                      icon: <Trash2 className="h-4 w-4" />,
                    },
                  ]}
                />
              ) : undefined
            }
          />
        )}

        {!isLoading && invites.length === 0 && (
          <p className="text-sm text-muted-foreground">No invites have been generated yet.</p>
        )}
      </div>
    </SectionCard>
  );
}
