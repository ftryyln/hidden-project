import { supabase } from "@/lib/supabase-client";
import type {
  AuditLog,
  DashboardKpis,
  GuildSummary,
  LootRecord,
  MonthlySummaryPoint,
  Transaction,
} from "@/lib/types";

export interface DashboardResponse {
  guilds: GuildSummary[];
  kpis: DashboardKpis;
  recentTransactions: Transaction[];
  recentLoot: LootRecord[];
  monthlySeries: MonthlySummaryPoint[];
  audit?: AuditLog[];
  activeGuildId?: string;
}

async function getGuildMemberCount(guildId: string): Promise<number> {
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("is_active", true);
  return count ?? 0;
}

async function getGuildBalance(guildId: string): Promise<number> {
  const { data, error } = await supabase.rpc("guild_current_balance", {
    p_guild_id: guildId,
  });
  if (error) {
    console.warn("Failed to fetch guild balance", error);
    return 0;
  }
  return Number(data ?? 0);
}

export async function fetchGuilds(): Promise<GuildSummary[]> {
  const { data, error } = await supabase
    .from("guild_user_roles")
    .select("guild_id, role, guild:guild_id ( id, name, tag )")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  const enriched = await Promise.all(
    data.map(async (row) => {
      const guildInfo = Array.isArray(row.guild) ? row.guild?.[0] : row.guild;
      const memberCount = await getGuildMemberCount(row.guild_id);
      const balance = await getGuildBalance(row.guild_id);
      return {
        id: row.guild_id,
        name: guildInfo?.name ?? "Unknown Guild",
        tag: guildInfo?.tag ?? "",
        balance,
        member_count: memberCount,
        role: row.role,
      } as GuildSummary;
    }),
  );

  return enriched;
}

export async function fetchDashboard(guildId?: string): Promise<DashboardResponse> {
  const guilds = await fetchGuilds();
  const activeGuildId = guildId ?? guilds[0]?.id;

  if (!activeGuildId) {
    return {
      guilds,
      activeGuildId: undefined,
      kpis: {
        active_members: 0,
        guild_balance: 0,
        income_month: 0,
        expense_month: 0,
      },
      recentTransactions: [],
      recentLoot: [],
      monthlySeries: [],
      audit: [],
    };
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  const [
    memberCount,
    guildBalance,
    transactionsThisMonth,
    monthlySummary,
    recentTransactions,
    recentLoot,
    auditLogs,
  ] = await Promise.all([
    getGuildMemberCount(activeGuildId),
    getGuildBalance(activeGuildId),
    supabase
      .from("transactions")
      .select("tx_type, amount")
      .eq("guild_id", activeGuildId)
      .eq("confirmed", true)
      .gte("created_at", startOfMonth.toISOString())
      .lte("created_at", endOfMonth.toISOString()),
    supabase
      .from("vw_monthly_summary")
      .select("year, month, income_total, expense_total")
      .eq("guild_id", activeGuildId)
      .order("year", { ascending: true })
      .order("month", { ascending: true }),
    supabase
      .from("transactions")
      .select(
        "id, guild_id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path, profiles:profiles!transactions_created_by_fkey(display_name,email)",
      )
      .eq("guild_id", activeGuildId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("loot_records")
      .select("id, guild_id, created_at, boss_name, item_name, item_rarity, estimated_value, distributed, distributed_at, notes")
      .eq("guild_id", activeGuildId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_logs")
      .select(
        "id, guild_id, user_id, action, payload, created_at, profiles:profiles!audit_logs_user_id_fkey(display_name,email)",
      )
      .eq("guild_id", activeGuildId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const kpis = {
    active_members: memberCount,
    guild_balance: guildBalance,
    income_month:
      transactionsThisMonth.data?.reduce((sum, tx) => (tx.tx_type === "income" ? sum + Number(tx.amount ?? 0) : sum), 0) ??
      0,
    expense_month:
      transactionsThisMonth.data?.reduce(
        (sum, tx) => (tx.tx_type === "expense" ? sum + Number(tx.amount ?? 0) : sum),
        0,
      ) ?? 0,
  };

  const monthlySeries =
    monthlySummary.data?.map((row) => ({
      month: `${row.year}-${String(row.month).padStart(2, "0")}`,
      income: Number(row.income_total ?? 0),
      expense: Number(row.expense_total ?? 0),
    })) ?? [];

  const transactions: Transaction[] =
    recentTransactions.data?.map((tx) => {
      const profile = Array.isArray(tx.profiles) ? tx.profiles?.[0] : tx.profiles;
      return {
        id: tx.id,
        guild_id: tx.guild_id,
        created_at: tx.created_at,
        tx_type: tx.tx_type,
        category: tx.category,
        amount: Number(tx.amount ?? 0),
        description: tx.description,
        confirmed: tx.confirmed,
        confirmed_at: tx.confirmed_at,
        created_by: tx.created_by,
        created_by_name: profile?.display_name ?? profile?.email ?? tx.created_by ?? "Unknown",
        evidence_path: tx.evidence_path ?? undefined,
      };
    }) ?? [];

  const loot: LootRecord[] =
    recentLoot.data?.map((row) => ({
      id: row.id,
      guild_id: row.guild_id,
      created_at: row.created_at,
      boss_name: row.boss_name ?? "",
      item_name: row.item_name ?? "",
      item_rarity: row.item_rarity,
      estimated_value: Number(row.estimated_value ?? 0),
      distributed: row.distributed,
      distributed_at: row.distributed_at ?? undefined,
      notes: row.notes ?? undefined,
    })) ?? [];

  const audit: AuditLog[] =
    auditLogs.data?.map((log) => {
      const profile = Array.isArray(log.profiles) ? log.profiles?.[0] : log.profiles;
      return {
        id: log.id,
        guild_id: log.guild_id,
        user_id: log.user_id ?? undefined,
        action: log.action,
        payload: log.payload ?? {},
        created_at: log.created_at,
        user_name: profile?.display_name ?? profile?.email,
      };
    }) ?? [];

  return {
    guilds,
    activeGuildId,
    kpis,
    recentTransactions: transactions,
    recentLoot: loot,
    monthlySeries,
    audit,
  };
}
