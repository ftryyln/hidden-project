"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, Mail, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/responsive/section-card";
import type { GuildInvite, GuildRole } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { INVITE_TTL_OPTIONS, ROLE_OPTIONS } from "./constants";

type InviteStatusFilter = GuildInvite["status"] | "all";

const INVITE_STATUS_FILTERS: Array<{ value: InviteStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "used", label: "Used" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
  { value: "superseded", label: "Superseded" },
];

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
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<InviteStatusFilter>("all");

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredInvites = useMemo(() => {
    return invites.filter((invite) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        (invite.email ?? "open invite").toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || invite.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invites, normalizedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch, statusFilter, invites.length]);

  const totalPages = Math.max(1, Math.ceil(filteredInvites.length / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pageInvites = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredInvites.slice(start, start + PAGE_SIZE);
  }, [filteredInvites, page]);

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
            <Button
              type="button"
              className="rounded-full lg:self-end"
              disabled={generating}
              onClick={onGenerateInvite}
            >
              {generating ? "Generating..." : "Generate invite"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You do not have permission to generate invites for this guild.
          </p>
        )}

        {lastInviteInfo && (
          <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
            <p className="text-sm font-semibold">
              {lastInviteInfo.email
                ? `Invite ready for ${lastInviteInfo.email}`
                : lastInviteInfo.url
                  ? "Latest invite link"
                  : "Latest invite token"}
            </p>
            <p className="text-xs text-muted-foreground">
              {lastInviteInfo.url || lastInviteInfo.token
                ? "Share the details below with the invitee. Keys are shown only once."
                : lastInviteInfo.email
                  ? "We emailed the invite link directly to the recipient."
                  : "Invite generated. Copy the link or token if available."}
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
              {!lastInviteInfo.url && lastInviteInfo.email && (
                <div className="rounded-2xl border border-dashed border-border/40 px-3 py-2 text-xs text-muted-foreground">
                  Invite email sent. Ask the recipient to check their inbox (and spam folder).
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              type="search"
              placeholder="Search invites"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="rounded-full sm:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as InviteStatusFilter)}>
              <SelectTrigger className="w-full rounded-full sm:w-56">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                {INVITE_STATUS_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isLoading && pageInvites.length > 0 && (
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
                {pageInvites.map((invite) => (
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
                    <TableCell className="whitespace-nowrap">{invite.default_role}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
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
                          onClick={() => onRevokeInvite(invite.id)}
                          aria-label="Revoke invite"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

        {!isLoading && invites.length === 0 && (
          <p className="text-sm text-muted-foreground">No invites have been generated yet.</p>
        )}

        {!isLoading && invites.length > 0 && filteredInvites.length === 0 && (
          <p className="text-sm text-muted-foreground">No invites match your filters.</p>
        )}

        {!isLoading && filteredInvites.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
