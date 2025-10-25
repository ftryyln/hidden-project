import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type { Transaction, TransactionType } from "../types.js";
import { getRange } from "../utils/pagination.js";
import { recordAuditLog } from "./audit.js";

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

function mapTransaction(row: Record<string, unknown>): Transaction {
  const profile = Array.isArray(row.profiles) ? row.profiles?.[0] : (row.profiles as Record<string, unknown> | undefined);
  return {
    id: row.id as string,
    guild_id: row.guild_id as string,
    created_at: row.created_at as string,
    created_by: row.created_by as string,
    created_by_name:
      (profile?.display_name as string | undefined) ??
      (profile?.email as string | undefined) ??
      (row.created_by as string | undefined) ??
      "Unknown",
    tx_type: row.tx_type as Transaction["tx_type"],
    category: (row.category as string) ?? "",
    amount: Number(row.amount ?? 0),
    description: (row.description as string | null) ?? undefined,
    confirmed: Boolean(row.confirmed),
    confirmed_at: (row.confirmed_at as string | null) ?? undefined,
    evidence_path: (row.evidence_path as string | null) ?? undefined,
  };
}

export async function listTransactions(
  guildId: string,
  filters: TransactionFilters,
): Promise<TransactionListResponse> {
  const { from, to } = getRange(filters.page ?? 1, filters.pageSize ?? 25);

  let query = supabaseAdmin
    .from("transactions")
    .select(
      "id, guild_id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path, profiles:profiles!transactions_created_by_fkey(display_name,email)",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type) {
    query = query.eq("tx_type", filters.type);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("created_at", filters.to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to load transactions", error);
    throw new ApiError(500, "Unable to load transactions");
  }

  return {
    transactions: (data ?? []).map(mapTransaction),
    total: count ?? 0,
  };
}

export interface CreateTransactionPayload {
  tx_type: TransactionType;
  category: string;
  amount: number;
  description?: string | null;
  evidence_path?: string | null;
}

export async function createTransaction(
  guildId: string,
  userId: string,
  payload: CreateTransactionPayload,
): Promise<Transaction> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      guild_id: guildId,
      created_by: userId,
      tx_type: payload.tx_type,
      category: payload.category,
      amount: payload.amount,
      description: payload.description ?? null,
      evidence_path: payload.evidence_path ?? null,
    })
    .select(
      "id, guild_id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path, profiles:profiles!transactions_created_by_fkey(display_name,email)",
    )
    .single();

  if (error) {
    console.error("Failed to create transaction", error);
    throw new ApiError(500, "Unable to create transaction");
  }

  return mapTransaction(data);
}

export async function confirmTransaction(
  guildId: string,
  transactionId: string,
  userId: string,
): Promise<Transaction> {
  const { data: existing, error: loadError } = await supabaseAdmin
    .from("transactions")
    .select("id, guild_id, confirmed")
    .eq("id", transactionId)
    .maybeSingle();

  if (loadError) {
    console.error("Failed to load transaction for confirmation", loadError);
    throw new ApiError(500, "Unable to confirm transaction");
  }

  if (!existing || existing.guild_id !== guildId) {
    throw new ApiError(404, "Transaction not found");
  }

  if (existing.confirmed) {
    throw new ApiError(400, "Transaction already confirmed");
  }

  const confirmedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .update({
      confirmed: true,
      confirmed_by: userId,
      confirmed_at: confirmedAt,
    })
    .eq("id", transactionId)
    .select(
      "id, guild_id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path, profiles:profiles!transactions_created_by_fkey(display_name,email)",
    )
    .single();

  if (error) {
    console.error("Failed to confirm transaction", error);
    throw new ApiError(500, "Unable to confirm transaction");
  }

  await recordAuditLog(supabaseAdmin, {
    guildId,
    userId,
    action: "transaction.confirmed",
    data: {
      transaction_id: transactionId,
      confirmed_at: confirmedAt,
    },
  });

  return mapTransaction(data);
}
