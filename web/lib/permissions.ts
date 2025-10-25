
import type { AuthProfile, GuildRole } from "@/lib/types";

export interface GuildPermissions {
  role: GuildRole | null;
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageTransactions: boolean;
  canManageLoot: boolean;
  canExportReports: boolean;
}

export function deriveGuildRole(
  user: AuthProfile | null | undefined,
  guildId?: string,
): GuildRole | null {
  if (!user) return null;
  if (guildId) {
    const assignment = user.guild_roles?.find((role) => role.guild_id === guildId);
    if (assignment) {
      return assignment.role;
    }
  }
  return user.app_role ?? null;
}

export function getGuildPermissions(role: GuildRole | null): GuildPermissions {
  switch (role) {
    case "guild_admin":
      return {
        role,
        canManageMembers: true,
        canManageRoles: true,
        canManageTransactions: true,
        canManageLoot: true,
        canExportReports: true,
      };
    case "officer":
      return {
        role,
        canManageMembers: false,
        canManageRoles: false,
        canManageTransactions: true,
        canManageLoot: true,
        canExportReports: true,
      };
    case "raider":
      return {
        role,
        canManageMembers: false,
        canManageRoles: false,
        canManageTransactions: false,
        canManageLoot: true,
        canExportReports: false,
      };
    case "member":
    case "viewer":
    default:
      return {
        role,
        canManageMembers: false,
        canManageRoles: false,
        canManageTransactions: false,
        canManageLoot: false,
        canExportReports: false,
      };
  }
}
