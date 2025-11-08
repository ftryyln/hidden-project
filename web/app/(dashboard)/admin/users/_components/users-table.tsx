"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AdminGuildSummary, AdminUserSummary, UserRole } from "@/lib/types";
import { PlusCircle, Trash2 } from "lucide-react";

interface UsersTableProps {
  users: AdminUserSummary[];
  loading: boolean;
  isSearchActive: boolean;
  guilds: AdminGuildSummary[];
  appRoleOptions: Array<{ value: UserRole | "auto"; label: string }>;
  pendingAppRoles: Record<string, UserRole | "auto" | null>;
  roleUpdatingUserId: string | null;
  currentUserId?: string;
  onOpenAssign: (user: AdminUserSummary) => void;
  onRemoveGuildAccess: (userId: string, guildId: string) => void;
  removeAccessDisabled: boolean;
  onDeleteUser: (user: AdminUserSummary) => void;
  deleteDisabled: boolean;
  onChangeAppRole: (userId: string, role: UserRole | null) => void;
}

export function UsersTable({
  users,
  loading,
  isSearchActive,
  guilds,
  appRoleOptions,
  pendingAppRoles,
  roleUpdatingUserId,
  currentUserId,
  onOpenAssign,
  onRemoveGuildAccess,
  removeAccessDisabled,
  onDeleteUser,
  deleteDisabled,
  onChangeAppRole,
}: UsersTableProps) {
  if (loading) {
    return null;
  }

  if (users.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
        {isSearchActive ? "No users match your search." : "No users found. Invite members to manage access."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Guild access</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((entry) => {
            const isCurrentUser = entry.id === currentUserId;
            const currentAppRoleValue = pendingAppRoles[entry.id] ?? entry.app_role ?? "auto";

            return (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium">{entry.display_name ?? "Unnamed user"}</p>
                    <p className="text-xs text-muted-foreground">{entry.email ?? "Email unavailable"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={currentAppRoleValue ?? "auto"}
                    onValueChange={(value) => {
                      if (value === "auto") {
                        onChangeAppRole(entry.id, null);
                        return;
                      }
                      onChangeAppRole(entry.id, value as UserRole);
                    }}
                    disabled={roleUpdatingUserId === entry.id}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {appRoleOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          disabled={
                            isCurrentUser && entry.app_role === "super_admin" && option.value !== "super_admin"
                          }
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {entry.guilds.length === 0 && (
                      <span className="text-xs text-muted-foreground">No guild access</span>
                    )}
                    {entry.guilds.map((assignment) => (
                      <div
                        key={`${entry.id}-${assignment.guild_id}`}
                        className="flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs"
                      >
                        <span className="font-semibold">{assignment.guild_tag}</span>
                        <Badge variant="secondary" className="capitalize">
                          {assignment.role.replace(/_/g, " ")}
                        </Badge>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground transition hover:text-destructive"
                          onClick={() => onRemoveGuildAccess(entry.id, assignment.guild_id)}
                          disabled={removeAccessDisabled}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenAssign(entry)}
                      disabled={guilds.length === 0}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteDisabled || isCurrentUser}
                      onClick={() => onDeleteUser(entry)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
