import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type { MonthlySummaryPoint, ReportsResponse } from "../types.js";

function toCsv(rows: Record<string, string | number | boolean | null>[], columns: string[]): string {
  const escape = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/["\r\n,]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const header = columns.join(",");
  const body = rows.map((row) => columns.map((col) => escape(row[col] ?? null)).join(","));
  return [header, ...body].join("\r\n");
}

export async function fetchReports(
  guildId: string,
  period: { from?: string; to?: string },
): Promise<ReportsResponse> {
  let baseQuery = supabaseAdmin
    .from("transactions")
    .select("tx_type, amount")
    .eq("guild_id", guildId)
    .eq("confirmed", true);

  if (period.from) {
    baseQuery = baseQuery.gte("created_at", period.from);
  }
  if (period.to) {
    baseQuery = baseQuery.lte("created_at", period.to);
  }

  const [{ data: txData, error: txError }, { data: seriesData, error: seriesError }] =
    await Promise.all([
      baseQuery,
      supabaseAdmin
        .from("vw_monthly_summary")
        .select("year, month, income_total, expense_total")
        .eq("guild_id", guildId)
        .order("year", { ascending: true })
        .order("month", { ascending: true }),
    ]);

  if (txError) {
    console.error("Failed to load transactions for reports", txError);
    throw new ApiError(500, "Unable to load report totals");
  }
  if (seriesError) {
    console.error("Failed to load monthly summary for reports", seriesError);
    throw new ApiError(500, "Unable to load report series");
  }

  const totals = (txData ?? []).reduce(
    (acc, tx) => {
      if (tx.tx_type === "income") {
        acc.income += Number(tx.amount ?? 0);
      } else if (tx.tx_type === "expense") {
        acc.expense += Number(tx.amount ?? 0);
      }
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const series: MonthlySummaryPoint[] =
    seriesData?.map((row) => ({
      month: `${row.year}-${String(row.month).padStart(2, "0")}`,
      income: Number(row.income_total ?? 0),
      expense: Number(row.expense_total ?? 0),
    })) ?? [];

  return {
    totals,
    series,
  };
}

export async function exportCsv(
  guildId: string,
  resource: "members" | "transactions",
  period: { from?: string; to?: string },
): Promise<{ filename: string; content: string }> {
  const fromDate = period.from ? new Date(period.from) : undefined;
  const toDate = period.to ? new Date(period.to) : undefined;

  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw new ApiError(400, "validation error", { from: "invalid date" });
  }
  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new ApiError(400, "validation error", { to: "invalid date" });
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new ApiError(400, "validation error", {
      period: "'from' must be before 'to'",
    });
  }

  const timestamp = Date.now();
  let filename = `${resource}-${guildId}-${timestamp}.csv`;
  let csv = "";

  if (resource === "members") {
    let query = supabaseAdmin
      .from("members")
      .select("id, in_game_name, role_in_guild, join_date, is_active, contact, notes, created_at")
      .eq("guild_id", guildId)
      .order("in_game_name", { ascending: true });

    if (fromDate) {
      query = query.gte("created_at", fromDate.toISOString());
    }
    if (toDate) {
      query = query.lte("created_at", toDate.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to export members", error);
      throw new ApiError(500, "Unable to export members");
    }

    const rows = (data ?? []).map((member) => ({
      member_id: member.id as string,
      in_game_name: (member.in_game_name as string) ?? "",
      role_in_guild: member.role_in_guild as string,
      join_date: (member.join_date as string | null) ?? "",
      is_active: Boolean(member.is_active),
      contact: member.contact ? JSON.stringify(member.contact) : "",
      notes: (member.notes as string | null) ?? "",
      created_at: member.created_at as string,
    }));

    csv = toCsv(rows, [
      "member_id",
      "in_game_name",
      "role_in_guild",
      "join_date",
      "is_active",
      "contact",
      "notes",
      "created_at",
    ]);
  } else {
    let query = supabaseAdmin
      .from("transactions")
      .select(
        "id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path",
      )
      .eq("guild_id", guildId)
      .order("created_at", { ascending: true });

    if (fromDate) {
      query = query.gte("created_at", fromDate.toISOString());
    }
    if (toDate) {
      query = query.lte("created_at", toDate.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to export transactions", error);
      throw new ApiError(500, "Unable to export transactions");
    }

    const rows = (data ?? []).map((tx) => ({
      transaction_id: tx.id as string,
      created_at: tx.created_at as string,
      tx_type: tx.tx_type as string,
      category: tx.category as string,
      amount: Number(tx.amount ?? 0).toFixed(2),
      description: (tx.description as string | null) ?? "",
      confirmed: Boolean(tx.confirmed),
      confirmed_at: (tx.confirmed_at as string | null) ?? "",
      created_by: tx.created_by as string,
      evidence_path: (tx.evidence_path as string | null) ?? "",
    }));

    csv = toCsv(rows, [
      "transaction_id",
      "created_at",
      "tx_type",
      "category",
      "amount",
      "description",
      "confirmed",
      "confirmed_at",
      "created_by",
      "evidence_path",
    ]);
  }

  return { filename, content: csv };
}
