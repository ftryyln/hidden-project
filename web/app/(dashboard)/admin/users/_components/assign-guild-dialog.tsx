"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AdminGuildSummary, AdminUserSummary, GuildRole } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

interface AssignGuildDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  user: AdminUserSummary | null;
  guilds: AdminGuildSummary[];
  onAssign: (userId: string, guildId: string, role: GuildRole) => Promise<void>;
  loading: boolean;
}

const roleOptions: Array<{ value: GuildRole; label: string }> = [
  { value: "guild_admin", label: "Guild Admin" },
  { value: "officer", label: "Officer" },
  { value: "raider", label: "Raider" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export function AssignGuildDialog({
  open,
  onOpenChange,
  user,
  guilds,
  onAssign,
  loading,
}: AssignGuildDialogProps) {
  const [selectedGuild, setSelectedGuild] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<GuildRole>("member");
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setSelectedGuild(guilds[0]?.id ?? "");
      setSelectedRole("member");
    }
  }, [open, guilds]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      onOpenChange(false);
      return;
    }
    if (!selectedGuild) {
      toast({
        title: "Select a guild",
        description: "Choose a guild before assigning the user.",
      });
      return;
    }
    await onAssign(user.id, selectedGuild, selectedRole);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign user to guild</DialogTitle>
          <DialogDescription>
            Pick a guild and role to grant access for {user?.display_name ?? user?.email ?? "this user"}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="guild">Guild</Label>
            <Select value={selectedGuild} onValueChange={setSelectedGuild}>
              <SelectTrigger id="guild">
                <SelectValue placeholder="Select guild" />
              </SelectTrigger>
              <SelectContent>
                {guilds.map((guild) => (
                  <SelectItem key={guild.id} value={guild.id}>
                    {guild.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as GuildRole)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || guilds.length === 0}>
              {loading ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
