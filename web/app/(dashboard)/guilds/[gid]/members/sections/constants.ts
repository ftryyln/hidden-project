import type { GuildRole } from "@/lib/types";

export const ROLE_OPTIONS: { value: GuildRole; label: string }[] = [
  { value: "guild_admin", label: "Guild admin" },
  { value: "officer", label: "Officer" },
  { value: "raider", label: "Raider" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export const INVITE_TTL_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];
