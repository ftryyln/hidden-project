"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { AdminGuildSummary } from "@/lib/types";
import { Crown, Pencil, Trash2, Users, Shield } from "lucide-react";

interface GuildDirectoryTableProps {
  guilds?: AdminGuildSummary[];
  loading: boolean;
  onEdit: (guild: AdminGuildSummary) => void;
  onManageAdmins: (guild: AdminGuildSummary) => void;
  onDelete: (guild: AdminGuildSummary) => void;
  deleteDisabled: boolean;
}

export function GuildDirectoryTable({
  guilds,
  loading,
  onEdit,
  onManageAdmins,
  onDelete,
  deleteDisabled,
}: GuildDirectoryTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    );
  }

  if (!loading && (!guilds || guilds.length === 0)) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No guilds available yet. Create the first guild to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Guild admins</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guilds?.map((guild) => (
            <TableRow key={guild.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">{guild.name}</span>
                  <span className="text-xs text-muted-foreground">{guild.tag}</span>
                  {guild.description && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {guild.description}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{guild.member_count ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>{guild.admin_count ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {new Date(guild.created_at).toLocaleDateString()}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                    onClick={() => onManageAdmins(guild)}
                  >
                    <Crown className="h-4 w-4" />
                    <span className="sr-only">Manage admins</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full"
                    onClick={() => onEdit(guild)}
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit guild</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full text-destructive"
                    disabled={deleteDisabled}
                    onClick={() => onDelete(guild)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Delete guild</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
