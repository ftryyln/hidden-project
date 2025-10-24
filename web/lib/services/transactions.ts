import { supabase } from "@/lib/supabase-client";
import type { Transaction, TransactionType } from "@/lib/types";

export interface TransactionFilters {
  from?: string;
  to?: string;
  type?: TransactionType;
  page?: number;
  pageSize?: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
}

export async function fetchTransactions(
  guildId: string,
  filters: TransactionFilters = {},
): Promise<TransactionListResponse> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("transactions")
    .select(
      "id, guild_id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path, profiles:profiles!transactions_created_by_fkey(display_name,email)",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type && filters.type !== "transfer") {
    query = query.eq("tx_type", filters.type);
  } else if (filters.type === "transfer") {
    query = query.eq("tx_type", "transfer");
  }

  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }

  if (filters.to) {
    query = query.lte("created_at", filters.to);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    transactions:
      data?.map((row): Transaction => {
        const profile = Array.isArray(row.profiles) ? row.profiles?.[0] : row.profiles;
        return {
          id: row.id,
          guild_id: row.guild_id,
          created_at: row.created_at,
          tx_type: row.tx_type,
          category: row.category,
          amount: Number(row.amount ?? 0),
          description: row.description ?? undefined,
          confirmed: row.confirmed,
          confirmed_at: row.confirmed_at ?? undefined,
          created_by: row.created_by,
          created_by_name: profile?.display_name ?? profile?.email ?? row.created_by ?? "Unknown",
          evidence_path: row.evidence_path ?? undefined,
        };
      }) ?? [],
    total: count ?? 0,
  };
}

export interface CreateTransactionInput {
  tx_type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  evidence_path?: string;
}

export async function createTransaction(guildId: string, payload: CreateTransactionInput) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error("Unable to determine current user.");
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      guild_id: guildId,
      created_by: user.user.id,
      tx_type: payload.tx_type,
      category: payload.category,
      amount: payload.amount,
      description: payload.description ?? null,
      evidence_path: payload.evidence_path ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    amount: Number(data.amount ?? 0),
    evidence_path: data.evidence_path ?? undefined,
  } as Transaction;
}

export async function confirmTransaction(guildId: string, transactionId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.id) {
    throw new Error("Unable to determine current user.");
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      confirmed: true,
      confirmed_by: user.user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("guild_id", guildId)
    .eq("id", transactionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    amount: Number(data.amount ?? 0),
    evidence_path: data.evidence_path ?? undefined,
  } as Transaction;
}
