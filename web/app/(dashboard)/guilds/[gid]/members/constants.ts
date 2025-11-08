import type { AuditAction } from "@/lib/types";

export const membersQueryKey = (guildId: string, search: string, showInactive: boolean) =>
  ["guild", guildId, "members", { search, showInactive }] as const;

export const accessQueryKey = (guildId: string) => ["guild", guildId, "access-control"] as const;

export const invitesQueryKey = (guildId: string) => ["guild", guildId, "invites"] as const;

export const auditQueryKey = (guildId: string, filter: string) => ["guild", guildId, "audit-logs", { filter }] as const;

export type AuditFilterKey = "all" | "transactions" | "roles" | "invites" | "loot" | "guild";

export const AUDIT_FILTER_OPTIONS: Array<{ value: AuditFilterKey; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "transactions", label: "Transactions" },
  { value: "roles", label: "Role changes" },
  { value: "invites", label: "Invites" },
  { value: "loot", label: "Loot" },
  { value: "guild", label: "Guild updates" },
];

export const AUDIT_FILTER_MAP: Record<AuditFilterKey, AuditAction[] | undefined> = {
  all: undefined,
  transactions: ["TRANSACTION_CREATED", "TRANSACTION_UPDATED", "TRANSACTION_DELETED", "TRANSACTION_CONFIRMED"],
  roles: ["ROLE_ASSIGNED", "ROLE_REVOKED"],
  invites: ["INVITE_CREATED", "INVITE_REVOKED", "INVITE_ACCEPTED"],
  loot: ["LOOT_CREATED", "LOOT_UPDATED", "LOOT_DELETED", "LOOT_DISTRIBUTED"],
  guild: ["GUILD_CREATED", "GUILD_UPDATED", "GUILD_DELETED"],
};

export const AUDIT_PAGE_SIZE = 50;
