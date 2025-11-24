
import type { AuthProfile, UserRole } from "@/lib/types";

export interface GuildPermissions {
  role: UserRole | null;
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageTransactions: boolean;
  canManageLoot: boolean;
  canExportReports: boolean;
  canManageInvites: boolean;
  canViewAudit: boolean;
  canViewGlobalAudit: boolean;
}

export function deriveGuildRole(
  user: AuthProfile | null | undefined,
  guildId?: string,
): UserRole | null {
  if (!user) return null;
  if (user.app_role === "super_admin") {
    return "super_admin";
  }
  if (guildId) {
    const assignment = user.guild_roles?.find((role) => role.guild_id === guildId);
    if (assignment) {
      return assignment.role;
    }
  }
  return user.app_role ?? null;
}

export function getGuildPermissions(role: UserRole | null): GuildPermissions {
  switch (role) {
    case "super_admin":
      return {
        role,
        canManageMembers: true,
        canManageRoles: true,
        canManageTransactions: true,
        canManageLoot: true,
        canExportReports: true,
        canManageInvites: true,
        canViewAudit: true,
        canViewGlobalAudit: true,
      };
    case "guild_admin":
      return {
        role,
        canManageMembers: true,
        canManageRoles: true,
        canManageTransactions: true,
        canManageLoot: true,
        canExportReports: true,
        canManageInvites: true,
        canViewAudit: true,
        canViewGlobalAudit: false,
      };
    case "officer":
      return {
        role,
        canManageMembers: true,
        canManageRoles: false,
        canManageTransactions: true,
        canManageLoot: true,
        canExportReports: true,
        canManageInvites: false,
        canViewAudit: true,
        canViewGlobalAudit: false,
      };
    case "raider":
      return {
        role,
        canManageMembers: false,
        canManageRoles: false,
        canManageTransactions: false,
        canManageLoot: false,
        canExportReports: false,
        canManageInvites: false,
        canViewAudit: true,
        canViewGlobalAudit: false,
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
        canManageInvites: false,
        canViewAudit: false,
        canViewGlobalAudit: false,
      };
  }
}
