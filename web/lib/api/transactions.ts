import { api } from "@/lib/api";
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

export interface CreateTransactionPayload {
  tx_type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  evidence_path?: string;
}

export async function listTransactions(
  guildId: string,
  filters: TransactionFilters = {},
): Promise<TransactionListResponse> {
  const { data } = await api.get<TransactionListResponse>(
    `/guilds/${guildId}/transactions`,
    {
      params: filters,
    },
  );
  return data;
}

export async function createTransaction(
  guildId: string,
  payload: CreateTransactionPayload,
): Promise<Transaction> {
  const { data } = await api.post<Transaction>(`/guilds/${guildId}/transactions`, payload);
  return data;
}

export async function updateTransaction(
  guildId: string,
  transactionId: string,
  payload: CreateTransactionPayload,
): Promise<Transaction> {
  const { data } = await api.patch<Transaction>(
    `/guilds/${guildId}/transactions/${transactionId}`,
    payload,
  );
  return data;
}

export async function confirmTransaction(
  guildId: string,
  transactionId: string,
): Promise<Transaction> {
  const { data } = await api.post<Transaction>(
    `/guilds/${guildId}/transactions/${transactionId}/confirm`,
    {},
  );
  return data;
}

export async function deleteTransaction(
  guildId: string,
  transactionId: string,
): Promise<void> {
  await api.delete(`/guilds/${guildId}/transactions/${transactionId}`);
}
