"use client";

import { useMemo } from "react";
import { Trash2, Shield } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/responsive/section-card";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/responsive/responsive-table";
import { ActionMenu } from "@/components/responsive/action-menu";
import type { GuildRole, GuildRoleAssignment } from "@/lib/types";

import { ROLE_OPTIONS } from "./constants";

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
  const columns: ResponsiveTableColumn<GuildRoleAssignment>[] = useMemo(
    () => [
      {
        header: "User",
        cell: (assignment) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {assignment.user?.display_name ?? assignment.user?.email ?? assignment.user_id}
            </span>
            <span className="text-xs text-muted-foreground">
              {assignment.user?.email ?? "Pending user"}
            </span>
          </div>
        ),
      },
      {
        header: "Role",
        cell: (assignment) => (
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
        ),
      },
      {
        header: "Source",
        cell: (assignment) => (
          <Badge variant="outline" className="uppercase">
            {assignment.source ?? "manual"}
          </Badge>
        ),
        stackedLabel: "Source",
      },
      {
        header: "Updated",
        cell: (assignment) => (
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(assignment.assigned_at)}
          </span>
        ),
        hideOnMobile: true,
      },
      {
        header: "Actions",
        hideOnMobile: true,
        className: "text-right",
        cell: (assignment) =>
          canManageRoles ? (
            <div className="flex justify-end">
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
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No actions</span>
          ),
      },
    ],
    [canManageRoles, disableRoleChange, formatRelativeTime, onAssignmentRoleChange, onRevokeAccess],
  );

  return (
    <SectionCard
      title="Guild access control"
      description="Promote members to manage guild resources."
      icon={<Shield className="h-5 w-5" />}
    >
      <div className="space-y-4">
        {canManageRoles ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-1">
              <span className="text-sm font-semibold">User email</span>
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
            <Button type="button" className="md:self-center" disabled={granting} onClick={onGrantAccess}>
              {granting ? "Granting..." : "Grant access"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You can view access assignments but do not have permission to modify them.
          </p>
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

        {!isLoading && assignments.length > 0 && (
          <ResponsiveTable
            columns={columns}
            data={assignments}
            getRowId={(row) => row.id}
            renderMobileRowExtras={(assignment) =>
              canManageRoles ? (
                <ActionMenu
                  ariaLabel={`Access actions for ${assignment.user?.display_name ?? assignment.user?.email ?? assignment.user_id}`}
                  items={[
                    {
                      label: "Revoke access",
                      destructive: true,
                      disabled: disableRoleChange(assignment),
                      onSelect: () => onRevokeAccess(assignment.user_id),
                      icon: <Trash2 className="h-4 w-4" />,
                    },
                  ]}
                />
              ) : undefined
            }
          />
        )}
      </div>
    </SectionCard>
  );
}
