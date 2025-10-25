export type GuildRole = "guild_admin" | "officer" | "raider" | "member" | "viewer";
export type MemberRole = "leader" | "officer" | "raider" | "casual";
export type TransactionType = "income" | "expense" | "transfer";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  app_role: GuildRole | null;
}

export interface GuildRoleAssignment {
  guild_id: string;
  user_id: string;
  role: GuildRole;
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

export interface Member {
  id: string;
  guild_id: string;
  user_id?: string | null;
  in_game_name: string;
  role_in_guild: MemberRole;
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

export interface AuditLog {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  user_name?: string;
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
