
export type UserRole = "super_admin" | "guild_admin" | "officer" | "raider" | "member" | "viewer";
export type GuildRole = Exclude<UserRole, "super_admin">;
export type MemberRole = "leader" | "officer" | "raider" | "casual";
export type TransactionType = "income" | "expense" | "transfer";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type AssignmentSource = "invite" | "manual" | "seed" | "system";
export type InviteStatus = "pending" | "revoked" | "used" | "expired" | "superseded";
export type AuditAction =
  | "ROLE_ASSIGNED"
  | "ROLE_REVOKED"
  | "INVITE_CREATED"
  | "INVITE_REVOKED"
  | "INVITE_ACCEPTED"
  | "GUILD_CREATED"
  | "GUILD_UPDATED"
  | "GUILD_DELETED"
  | "TRANSACTION_CREATED"
  | "TRANSACTION_UPDATED"
  | "TRANSACTION_DELETED"
  | "TRANSACTION_CONFIRMED"
  | "LOOT_CREATED"
  | "LOOT_UPDATED"
  | "LOOT_DELETED"
  | "LOOT_DISTRIBUTED"
  | "PAYROLL_BATCH_CREATED";

export type PayrollSource = "TRANSACTION" | "LOOT";
export type PayrollMode = "EQUAL" | "PERCENTAGE" | "FIXED";

export interface PayrollSummary {
  source: PayrollSource;
  availableBalance: number;
  asOf: string;
}

export interface PayrollMemberShare {
  memberId: string;
  amount?: number;
  percentage?: number;
}

export interface PayrollBatchListItem {
  id: string;
  referenceCode?: string | null;
  source: PayrollSource;
  mode: PayrollMode;
  totalAmount: number;
  membersCount: number;
  distributedByName: string;
  createdAt: string;
  periodFrom?: string | null;
  periodTo?: string | null;
}

export interface PayrollBatchDetail {
  id: string;
  referenceCode?: string | null;
  source: PayrollSource;
  mode: PayrollMode;
  totalAmount: number;
  notes?: string | null;
  distributedByName: string;
  distributedByUserId: string;
  createdAt: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  balanceBefore: number;
  balanceAfter: number;
  items: Array<{
    memberId: string;
    memberName?: string | null;
    amount: number;
    percentage?: number | null;
  }>;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  app_role: UserRole | null;
}

export interface GuildRoleAssignment {
  id: string;
  guild_id: string;
  user_id: string;
  role: GuildRole;
  assigned_at: string;
  assigned_by_user_id: string | null;
  revoked_at: string | null;
  source: AssignmentSource;
  user?: {
    email?: string;
    display_name?: string;
  };
}

export interface AuthProfile extends AuthUser {
  guild_roles?: GuildRoleAssignment[];
}

export interface GuildSummary {
  id: string;
  name: string;
  tag: string;
  balance: number;
  member_count: number;
  role: GuildRole;
}

export interface AdminGuildSummary {
  id: string;
  name: string;
  tag: string;
  description?: string | null;
  member_count: number;
  admin_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUserAssignment {
  guild_id: string;
  guild_name: string;
  guild_tag: string;
  role: GuildRole;
}

export interface AdminUserSummary {
  id: string;
  email: string | null;
  display_name: string | null;
  app_role: UserRole | null;
  created_at: string | null;
  guilds: AdminUserAssignment[];
}

export interface Member {
  id: string;
  guild_id: string;
  user_id?: string | null;
  in_game_name: string;
  role_in_guild: MemberRole;
  class?: string | null;
  combat_power?: number | null;
  join_date?: string | null;
  notes?: string | null;
  contact?: Record<string, unknown> | null;
  is_active: boolean;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  guild_id: string;
  created_at: string;
  created_by: string;
  created_by_name?: string;
  tx_type: TransactionType;
  category: string;
  amount: number;
  description?: string | null;
  confirmed: boolean;
  confirmed_at?: string | null;
  evidence_path?: string | null;
}

export interface LootRecord {
  id: string;
  guild_id: string;
  created_at: string;
  boss_name: string;
  item_name: string;
  item_rarity: Rarity;
  estimated_value: number;
  distributed: boolean;
  distributed_at?: string | null;
  notes?: string | null;
}

export interface LootDistribution {
  member_id: string;
  share_amount: number;
}

export interface DashboardKpis {
  active_members: number;
  guild_balance: number;
  income_month: number;
  expense_month: number;
}

export interface MonthlySummaryPoint {
  month: string;
  income: number;
  expense: number;
}

export interface GuildInvite {
  id: string;
  guild_id: string;
  email?: string | null;
  default_role: GuildRole;
  expires_at: string;
  created_at: string;
  updated_at: string;
  status: InviteStatus;
  created_by_user_id: string;
  used_at?: string | null;
  used_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
  token?: string;
  invite_url?: string;
}

export interface AuditLog {
  id: string;
  guild_id?: string | null;
  actor_user_id?: string | null;
  actor_name?: string | null;
  target_user_id?: string | null;
  target_name?: string | null;
  action: AuditAction;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DashboardResponse {
  guilds: GuildSummary[];
  activeGuildId?: string;
  kpis: DashboardKpis;
  recentTransactions: Transaction[];
  recentLoot: LootRecord[];
  monthlySeries: MonthlySummaryPoint[];
  audit?: AuditLog[];
}

export interface ReportsResponse {
  totals: {
    income: number;
    expense: number;
  };
  series: MonthlySummaryPoint[];
}

export interface PaginatedResponse<T> {
  total: number;
  data: T[];
}

export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string | string[]>;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number | null;
  token_type: string;
  user: AuthUser;
}

export type AttendanceAction =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED";

export interface AttendanceSessionSummary {
  id: string;
  bossName?: string | null;
  mapName?: string | null;
  startedAt: string;
  attendeesCount: number;
  createdBy: string;
  createdByName?: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface AttendanceEntry {
  id: string;
  sessionId: string;
  memberId: string;
  memberName?: string | null;
  note?: string | null;
  lootTag?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceDetail {
  session: AttendanceSessionSummary;
  entries: AttendanceEntry[];
}

export interface AttendanceHistoryItem {
  id: string;
  sessionId: string;
  action: AttendanceAction;
  details?: Record<string, unknown> | null;
  performedBy: string;
  performerName?: string | null;
  performedAt: string;
}
