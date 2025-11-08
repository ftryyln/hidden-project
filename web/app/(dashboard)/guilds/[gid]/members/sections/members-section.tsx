"use client";

import { useMemo } from "react";
import { Pencil, Power, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/responsive/section-card";
import { FilterBar } from "@/components/responsive/filter-bar";
import { ResponsiveTable, type ResponsiveTableColumn } from "@/components/responsive/responsive-table";
import { ActionMenu, type ActionMenuItem } from "@/components/responsive/action-menu";
import type { Member } from "@/lib/types";
import { formatDate } from "@/lib/format";

interface MembersSectionProps {
  members: Member[];
  total: number;
  isLoading: boolean;
  emptyState: boolean;
  canManageMembers: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  showInactive: boolean;
  onToggleInactive: (value: boolean) => void;
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onToggleMemberStatus: (member: Member, nextState: boolean) => void;
  isMutating?: boolean;
}

export function MembersSection({
  members,
  total,
  isLoading,
  emptyState,
  canManageMembers,
  searchValue,
  onSearchChange,
  showInactive,
  onToggleInactive,
  onAddMember,
  onEditMember,
  onToggleMemberStatus,
  isMutating = false,
}: MembersSectionProps) {
  const columns: ResponsiveTableColumn<Member>[] = useMemo(
    () => [
      {
        header: "Name",
        cell: (member) => {
          const contact = (member.contact ?? {}) as Record<string, unknown>;
          const discord =
            typeof contact.discord === "string" && contact.discord.trim().length > 0
              ? (contact.discord as string)
              : "-";
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-sm font-semibold uppercase text-secondary-foreground">
                {getInitials(member.in_game_name)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight text-foreground">{member.in_game_name}</p>
                <p className="text-xs text-muted-foreground">{discord}</p>
              </div>
            </div>
          );
        },
        stackedLabel: "Name",
      },
      {
        header: "Role",
        cell: (member) => member.role_in_guild,
        stackedLabel: "Role",
      },
      {
        header: "Joined",
        cell: (member) => formatDate(member.join_date ?? ""),
        stackedLabel: "Joined",
        hideOnMobile: true,
      },
      {
        header: "Status",
        cell: (member) => (
          <Badge variant={member.is_active ? "success" : "secondary"}>
            {member.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
        ),
        stackedLabel: "Status",
      },
      {
        header: "Actions",
        hideOnMobile: true,
        cell: (member) =>
          canManageMembers ? (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                aria-label={`Edit ${member.in_game_name}`}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onEditMember(member)}
                disabled={isMutating}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                aria-label={member.is_active ? "Deactivate member" : "Activate member"}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onToggleMemberStatus(member, !member.is_active)}
                disabled={isMutating}
              >
                <Power className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No actions</span>
          ),
      },
    ],
    [canManageMembers, isMutating, onEditMember, onToggleMemberStatus],
  );

  const mobileActions = (member: Member) => {
    if (!canManageMembers) {
      return null;
    }

    const items: ActionMenuItem[] = [
      {
        label: "Edit",
        onSelect: () => onEditMember(member),
        icon: <Pencil className="h-4 w-4" />,
        disabled: isMutating,
      },
      {
        label: member.is_active ? "Deactivate" : "Activate",
        onSelect: () => onToggleMemberStatus(member, !member.is_active),
        icon: <Power className="h-4 w-4" />,
        disabled: isMutating,
      },
    ];

    return <ActionMenu ariaLabel={`Actions for ${member.in_game_name}`} items={items} />;
  };

  return (
    <SectionCard
      title="Roster"
      description={`${total} members in total`}
      actions={
        canManageMembers && (
          <Button
            type="button"
            onClick={onAddMember}
            className="rounded-full"
            aria-label="Add member"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add member
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <FilterBar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search members"
        >
          <Select
            value={showInactive ? "all" : "active"}
            onValueChange={(value) => onToggleInactive(value === "all")}
          >
            <SelectTrigger className="w-full rounded-full border-border/60 bg-background/80 sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active members</SelectItem>
              <SelectItem value="all">All members</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
          </div>
        )}

        {!isLoading && emptyState && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 p-10 text-center">
            <UserPlus className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No members yet</h3>
              <p className="text-sm text-muted-foreground">Add guild members to start tracking your roster.</p>
            </div>
            {canManageMembers && (
              <Button type="button" className="rounded-full" onClick={onAddMember}>
                Add member
              </Button>
            )}
          </div>
        )}

        {!isLoading && !emptyState && (
          <ResponsiveTable
            columns={columns}
            data={members}
            getRowId={(row) => row.id}
            emptyMessage="No members found."
            renderMobileRowExtras={mobileActions}
          />
        )}
      </div>
    </SectionCard>
  );
}

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
