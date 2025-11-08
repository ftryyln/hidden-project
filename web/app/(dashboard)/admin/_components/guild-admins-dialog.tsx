"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminGuildSummary, GuildRoleAssignment } from "@/lib/types";

interface GuildAdminsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guild: AdminGuildSummary | null;
  adminEmail: string;
  onAdminEmailChange: (value: string) => void;
  onAssign: () => void;
  assignDisabled: boolean;
  admins: GuildRoleAssignment[];
  isLoadingAdmins: boolean;
  onRemoveAdmin: (userId: string) => void;
  removeDisabled: boolean;
}

export function GuildAdminsDialog({
  open,
  onOpenChange,
  guild,
  adminEmail,
  onAdminEmailChange,
  onAssign,
  assignDisabled,
  admins,
  isLoadingAdmins,
  onRemoveAdmin,
  removeDisabled,
}: GuildAdminsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guild admins</DialogTitle>
          <DialogDescription>
            Invite or assign users as guild_admin for {guild?.name ?? "selected guild"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 p-4">
            <Label htmlFor="admin-email">Assign by email or user ID</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="admin-email"
                placeholder="user@example.com or user id"
                value={adminEmail}
                onChange={(event) => onAdminEmailChange(event.target.value)}
              />
              <Button onClick={onAssign} disabled={assignDisabled || !adminEmail}>
                Assign
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Existing users will be granted access immediately. New emails receive an invite.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Active admins
            </h4>
            {isLoadingAdmins && (
              <div className="space-y-2">
                <Skeleton className="h-10 rounded-2xl" />
                <Skeleton className="h-10 rounded-2xl" />
              </div>
            )}
            {!isLoadingAdmins && admins.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No guild admins assigned yet.
              </div>
            )}
            {admins.map((assignment) => (
              <div
                key={assignment.user_id}
                className="flex items-center justify-between rounded-2xl border border-border/60 p-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {assignment.user?.display_name ?? assignment.user?.email ?? assignment.user_id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Assigned at {new Date(assignment.assigned_at).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-destructive"
                  disabled={removeDisabled}
                  onClick={() => onRemoveAdmin(assignment.user_id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
