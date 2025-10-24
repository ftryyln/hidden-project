import { supabase } from "@/lib/supabase-client";
import type { MonthlySummaryPoint } from "@/lib/types";

export interface ReportsResponse {
  totals: {
    income: number;
    expense: number;
  };
  series: MonthlySummaryPoint[];
}

export async function fetchReports(
  guildId: string,
  period: { from?: string; to?: string },
): Promise<ReportsResponse> {
  let baseQuery = supabase
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
      supabase
        .from("vw_monthly_summary")
        .select("year, month, income_total, expense_total")
        .eq("guild_id", guildId)
        .order("year", { ascending: true })
        .order("month", { ascending: true }),
    ]);

  if (txError) {
    throw txError;
  }
  if (seriesError) {
    throw seriesError;
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

  const series =
    seriesData?.map(
      (row): MonthlySummaryPoint => ({
        month: `${row.year}-${String(row.month).padStart(2, "0")}`,
        income: Number(row.income_total ?? 0),
        expense: Number(row.expense_total ?? 0),
      }),
    ) ?? [];

  return {
    totals,
    series,
  };
}

export async function exportCsv(
  guildId: string,
  resource: "members" | "transactions",
  period: { from?: string; to?: string },
) {
  const { data, error } = await supabase.functions.invoke("export_csv", {
    body: {
      guild_id: guildId,
      resource,
      date_range: {
        from: period.from,
        to: period.to,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (typeof data !== "string") {
    throw new Error("Unexpected response while exporting CSV.");
  }

  return data;
}
