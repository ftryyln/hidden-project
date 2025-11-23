"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Shield } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/responsive/section-card";
import type { GuildRole, GuildRoleAssignment } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { ROLE_OPTIONS } from "./constants";

type RoleFilter = GuildRole | "all";

interface AccessControlSectionProps {
  assignments: GuildRoleAssignment[];
  isLoading: boolean;
  canManageRoles: boolean;
  accessEmail: string;
  onAccessEmailChange: (value: string) => void;
  accessRole: GuildRole;
  onAccessRoleChange: (role: GuildRole) => void;
  onGrantAccess: () => void;
  granting: boolean;
  onAssignmentRoleChange: (userId: string, role: GuildRole) => void;
  onRevokeAccess: (userId: string) => void;
  disableRoleChange: (assignment: GuildRoleAssignment) => boolean;
  formatRelativeTime: (iso: string | null | undefined) => string;
}

export function AccessControlSection({
  assignments,
  isLoading,
  canManageRoles,
  accessEmail,
  onAccessEmailChange,
  accessRole,
  onAccessRoleChange,
  onGrantAccess,
  granting,
  onAssignmentRoleChange,
  onRevokeAccess,
  disableRoleChange,
  formatRelativeTime,
}: AccessControlSectionProps) {
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      const display = `${assignment.user?.display_name ?? ""} ${assignment.user?.email ?? ""}`.toLowerCase();
      const matchesSearch = normalizedSearch.length === 0 || display.includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || assignment.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [assignments, normalizedSearch, roleFilter]);

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch, roleFilter, assignments.length]);

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pageAssignments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAssignments.slice(start, start + PAGE_SIZE);
  }, [filteredAssignments, page]);

  return (
    <SectionCard
      title="Guild Access Control"
      description="Promote members to manage guild resources."
      icon={<Shield className="h-5 w-5" />}
    >
      <div className="space-y-4">
        {canManageRoles ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-1">
              <span className="text-sm font-semibold">User Email</span>
              <Input
                type="email"
                placeholder="user@example.com"
                value={accessEmail}
                onChange={(event) => onAccessEmailChange(event.target.value)}
                disabled={granting}
              />
            </div>
            <div className="grid gap-1">
              <span className="text-sm font-semibold">Role</span>
              <Select
                value={accessRole}
                onValueChange={(value) => onAccessRoleChange(value as GuildRole)}
                disabled={granting}
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
              className="rounded-full lg:justify-self-end lg:self-end"
              disabled={granting}
              onClick={onGrantAccess}
            >
              {granting ? "Granting..." : "Grant access"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can view access assignments but do not have permission to modify them.
          </p>
        )}

        {assignments.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-border/40 p-3 sm:flex-row sm:items-center">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search users"
              className="rounded-full border-border/60 sm:w-64"
              aria-label="Search assignments"
            />
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
              <SelectTrigger className="rounded-full border-border/60 sm:w-48">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-12 rounded-3xl" />
            <Skeleton className="h-12 rounded-3xl" />
          </div>
        )}

        {!isLoading && assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No authenticated users are linked to this guild yet. Invite users or promote them to grant access.
          </p>
        )}

        {!isLoading && pageAssignments.length > 0 && (
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
                {pageAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {assignment.user?.display_name ?? assignment.user?.email ?? assignment.user_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {assignment.user?.email ?? "Pending user"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Select
                        value={assignment.role}
                        onValueChange={(value) => onAssignmentRoleChange(assignment.user_id, value as GuildRole)}
                        disabled={!canManageRoles || disableRoleChange(assignment)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
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
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatRelativeTime(assignment.assigned_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageRoles ? (
                        <Button
                          type="button"
                          aria-label="Revoke access"
                          variant="ghost"
                          size="icon"
                          disabled={disableRoleChange(assignment)}
                          onClick={() => onRevokeAccess(assignment.user_id)}
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

        {!isLoading && assignments.length > 0 && filteredAssignments.length === 0 && (
          <p className="text-sm text-muted-foreground">No assignments match your filters.</p>
        )}

        {!isLoading && filteredAssignments.length > 0 && (
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
