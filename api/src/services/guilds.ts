import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { userIsSuperAdmin } from "./access.js";
import type {
  DashboardResponse,
  GuildSummary,
  MonthlySummaryPoint,
  Transaction,
  LootRecord,
  AuditLog,
} from "../types.js";

async function getGuildMemberCount(guildId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("is_active", true);

  if (error) {
    console.error("Failed to count active members", error);
    throw new ApiError(500, "Unable to load guild members");
  }

  return count ?? 0;
}

async function getGuildBalance(guildId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("guild_current_balance", {
    p_guild_id: guildId,
  });

  if (error) {
    console.error("Failed to load guild balance", error);
    throw new ApiError(500, "Unable to load guild balance");
  }

  return Number(data ?? 0);
}

export async function fetchGuildSummaries(userId: string): Promise<GuildSummary[]> {
  if (await userIsSuperAdmin(userId)) {
    const { data, error } = await supabaseAdmin
      .from("guilds")
      .select("id, name, tag")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load guilds for super admin", error);
      throw new ApiError(500, "Unable to load guilds");
    }

    if (!data) {
      return [];
    }

    const summaries = await Promise.all(
      data.map(async (guild) => {
        const [memberCount, balance] = await Promise.all([
          getGuildMemberCount(guild.id),
          getGuildBalance(guild.id),
        ]);

        return {
          id: guild.id,
          name: guild.name ?? "Unknown Guild",
          tag: guild.tag ?? "",
          balance,
          member_count: memberCount,
          role: "guild_admin" as const,
        };
      }),
    );

    return summaries;
  }

  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select("guild_id, role, guild:guild_id ( id, name, tag )")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("assigned_at", { ascending: true });

  if (error) {
    console.error("Failed to load guild memberships", error);
    throw new ApiError(500, "Unable to load guilds");
  }

  if (!data) {
    return [];
  }

  // Filter out guilds where user only has viewer role
  const filteredData = data.filter((row) => row.role !== "viewer");

  const enriched = await Promise.all(
    filteredData.map(async (row): Promise<GuildSummary> => {
      const guildInfo = Array.isArray(row.guild) ? row.guild?.[0] : row.guild;
      const [memberCount, balance] = await Promise.all([
        getGuildMemberCount(row.guild_id),
        getGuildBalance(row.guild_id),
      ]);

      return {
        id: row.guild_id,
        name: guildInfo?.name ?? "Unknown Guild",
        tag: guildInfo?.tag ?? "",
        balance,
        member_count: memberCount,
        role: row.role,
      };
    }),
  );

  return enriched;
}

export async function fetchDashboard(
  userId: string,
  guildId?: string,
): Promise<DashboardResponse> {
  const guilds = await fetchGuildSummaries(userId);
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
    supabaseAdmin
      .from("transactions")
      .select("tx_type, amount")
      .eq("guild_id", activeGuildId)
      .eq("confirmed", true)
      .gte("created_at", startOfMonth.toISOString())
      .lte("created_at", endOfMonth.toISOString()),
    supabaseAdmin
      .from("vw_monthly_summary")
      .select("year, month, income_total, expense_total")
      .eq("guild_id", activeGuildId)
      .order("year", { ascending: true })
      .order("month", { ascending: true }),
    supabaseAdmin
      .from("transactions")
      .select(
        "id, guild_id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path, profiles:profiles!transactions_created_by_fkey(display_name,email)",
      )
      .eq("guild_id", activeGuildId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("loot_records")
      .select(
        "id, guild_id, created_at, boss_name, item_name, item_rarity, estimated_value, distributed, distributed_at, notes",
      )
      .eq("guild_id", activeGuildId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("audit_logs")
      .select(
        "id, guild_id, actor_user_id, target_user_id, action, metadata, created_at, actor:profiles!audit_logs_actor_user_id_fkey(display_name,email), target:profiles!audit_logs_target_user_id_fkey(display_name,email)",
      )
      .eq("guild_id", activeGuildId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (transactionsThisMonth.error) {
    console.error("Failed to load transactions for dashboard", transactionsThisMonth.error);
    throw new ApiError(500, "Unable to load dashboard transactions");
  }
  if (monthlySummary.error) {
    console.error("Failed to load monthly summary", monthlySummary.error);
    throw new ApiError(500, "Unable to load dashboard charts");
  }
  if (recentTransactions.error) {
    console.error("Failed to load recent transactions", recentTransactions.error);
    throw new ApiError(500, "Unable to load recent transactions");
  }
  if (recentLoot.error) {
    console.error("Failed to load recent loot", recentLoot.error);
    throw new ApiError(500, "Unable to load recent loot");
  }
  if (auditLogs.error) {
    console.error("Failed to load audit logs", auditLogs.error);
    throw new ApiError(500, "Unable to load audit history");
  }

  const kpis = {
    active_members: memberCount,
    guild_balance: guildBalance,
    income_month:
      transactionsThisMonth.data?.reduce(
        (sum, tx) => (tx.tx_type === "income" ? sum + Number(tx.amount ?? 0) : sum),
        0,
      ) ?? 0,
    expense_month:
      transactionsThisMonth.data?.reduce(
        (sum, tx) => (tx.tx_type === "expense" ? sum + Number(tx.amount ?? 0) : sum),
        0,
      ) ?? 0,
  };

  const monthlySeries: MonthlySummaryPoint[] =
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
      const actorProfile = Array.isArray(log.actor) ? log.actor?.[0] : log.actor;
      const targetProfile = Array.isArray(log.target) ? log.target?.[0] : log.target;
      return {
        id: log.id,
        guild_id: log.guild_id,
        actor_user_id: log.actor_user_id ?? null,
        actor_name: actorProfile?.display_name ?? actorProfile?.email ?? null,
        target_user_id: log.target_user_id ?? null,
        target_name: targetProfile?.display_name ?? targetProfile?.email ?? null,
        action: log.action,
        metadata: (log.metadata as Record<string, unknown>) ?? {},
        created_at: log.created_at,
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
