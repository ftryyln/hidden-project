import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type {
  PayrollBatchRecord,
  PayrollBatchWithItems,
  PayrollItemRecord,
  PayrollMode,
  PayrollSource,
} from "../types.js";
import { getRange } from "../utils/pagination.js";
import { recordAuditLog } from "./audit.js";

const PERCENT_EPSILON = 0.01;

export interface AvailableBalanceResult {
  balance: number;
  asOf: Date;
}

export interface PayrollMemberInput {
  memberId: string;
  amount?: number;
  percentage?: number;
}

export interface CreatePayrollBatchPayload {
  source: PayrollSource;
  mode: PayrollMode;
  totalAmount: number;
  periodFrom?: string | null;
  periodTo?: string | null;
  notes?: string | null;
  members: PayrollMemberInput[];
  distributedByUserId: string;
  distributedByName: string;
}

export interface PayrollBatchCreationResult {
  batchId: string;
  referenceCode?: string | null;
  totalAmount: number;
  source: PayrollSource;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  distributedByName: string;
}

export interface PayrollListFilters {
  page?: number;
  pageSize?: number;
  source?: PayrollSource;
  distributedByUserId?: string;
  memberId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PayrollListItem {
  id: string;
  referenceCode?: string | null;
  source: PayrollSource;
  totalAmount: number;
  membersCount: number;
  distributedByName: string;
  createdAt: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  mode: PayrollMode;
}

export interface PayrollListResponse {
  items: PayrollListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface MemberRow {
  id: string;
  guild_id: string;
  in_game_name: string;
}

interface AmountAllocation {
  memberId: string;
  amount: number;
  percentage?: number;
}

function toCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function centsToCurrency(value: number): number {
  return Math.round(value) / 100;
}

function buildReferenceCode(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(-4).toUpperCase();
  return `PAY-${year}${month}${day}-${suffix}`;
}

function mapBatch(row: Record<string, unknown>): PayrollBatchRecord {
  return {
    id: row.id as string,
    guild_id: row.guild_id as string,
    reference_code: (row.reference_code as string | null) ?? undefined,
    source: row.source as PayrollSource,
    mode: row.mode as PayrollMode,
    total_amount: Number(row.total_amount ?? 0),
    balance_before: Number(row.balance_before ?? 0),
    balance_after: Number(row.balance_after ?? 0),
    members_count: Number(row.members_count ?? 0),
    period_from: (row.period_from as string | null) ?? undefined,
    period_to: (row.period_to as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    distributed_by_user_id: row.distributed_by_user_id as string,
    distributed_by_name: (row.distributed_by_name as string) ?? "Unknown",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapItem(row: Record<string, unknown>): PayrollItemRecord {
  const member =
    (row.member as { in_game_name?: string } | null | undefined) ??
    (Array.isArray(row.members) ? row.members?.[0] : undefined);
  return {
    id: row.id as string,
    batch_id: row.batch_id as string,
    member_id: row.member_id as string,
    member_name: (member?.in_game_name as string | undefined) ?? undefined,
    amount: Number(row.amount ?? 0),
    percentage: (row.percentage as number | null | undefined) ?? undefined,
    created_at: row.created_at as string,
  };
}

async function fetchNumericFromRpc(
  fnName: string,
  params: Record<string, unknown>,
  context: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc(fnName, params);
  if (error) {
    console.error(`Failed to execute ${fnName}`, error);
    throw new ApiError(500, `Unable to compute ${context}`);
  }
  return Number(data ?? 0);
}

export async function getAvailableBalance(
  guildId: string,
  source: PayrollSource,
): Promise<AvailableBalanceResult> {
  const asOf = new Date();
  let pool = 0;

  if (source === "TRANSACTION") {
    pool = await fetchNumericFromRpc("payroll_sum_confirmed_income", { p_guild_id: guildId }, "income");
  } else {
    pool = await fetchNumericFromRpc("payroll_sum_loot_value", { p_guild_id: guildId }, "loot value");
  }

  const paid = await fetchNumericFromRpc(
    "payroll_sum_disbursed",
    { p_guild_id: guildId, p_source: source },
    "disbursed payroll totals",
  );

  const balance = Math.max(0, toCurrency(pool - paid));
  return { balance, asOf };
}

function ensureMembersUnique(memberIds: string[]): void {
  const unique = new Set(memberIds);
  if (unique.size !== memberIds.length) {
    throw new ApiError(400, "validation error", {
      members: "duplicate members are not allowed in a batch",
    });
  }
}

function allocateEqualAmounts(totalAmount: number, memberIds: string[]): AmountAllocation[] {
  const totalCents = cents(totalAmount);
  const baseShare = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - baseShare * memberIds.length;
  return memberIds.map((memberId, index) => {
    const bonus = index === memberIds.length - 1 ? remainder : 0;
    return {
      memberId,
      amount: centsToCurrency(baseShare + bonus),
    };
  });
}

function allocatePercentageAmounts(
  totalAmount: number,
  members: PayrollMemberInput[],
): AmountAllocation[] {
  const totalPercentage = members.reduce((acc, member) => acc + (member.percentage ?? 0), 0);
  if (Math.abs(totalPercentage - 100) > PERCENT_EPSILON) {
    throw new ApiError(400, "validation error", {
      members: "total percentage must equal 100%",
    });
  }

  const totalCents = cents(totalAmount);
  let allocatedCents = 0;

  return members.map((member, index) => {
    if (typeof member.percentage !== "number") {
      throw new ApiError(400, "validation error", {
        members: "percentage is required for every member in percentage mode",
      });
    }
    let shareCents = Math.round((totalCents * member.percentage) / 100);
    if (index === members.length - 1) {
      shareCents = totalCents - allocatedCents;
    } else {
      allocatedCents += shareCents;
    }
    return {
      memberId: member.memberId,
      amount: centsToCurrency(shareCents),
      percentage: toCurrency(member.percentage),
    };
  });
}

function allocateFixedAmounts(totalAmount: number, members: PayrollMemberInput[]): AmountAllocation[] {
  const totalFromMembers = members.reduce((acc, member) => acc + (member.amount ?? 0), 0);
  if (Math.abs(totalFromMembers - totalAmount) > PERCENT_EPSILON) {
    throw new ApiError(400, "validation error", {
      members: "sum of member amounts must equal total amount",
    });
  }

  return members.map((member) => {
    if (typeof member.amount !== "number") {
      throw new ApiError(400, "validation error", {
        members: "amount is required for every member in fixed mode",
      });
    }
    return {
      memberId: member.memberId,
      amount: toCurrency(member.amount),
    };
  });
}

function computeAllocations(payload: {
  mode: PayrollMode;
  totalAmount: number;
  members: PayrollMemberInput[];
}): AmountAllocation[] {
  switch (payload.mode) {
    case "EQUAL":
      return allocateEqualAmounts(payload.totalAmount, payload.members.map((member) => member.memberId));
    case "PERCENTAGE":
      return allocatePercentageAmounts(payload.totalAmount, payload.members);
    case "FIXED":
      return allocateFixedAmounts(payload.totalAmount, payload.members);
    default:
      return [];
  }
}

async function fetchMembers(
  guildId: string,
  memberIds: string[],
): Promise<Map<string, MemberRow>> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, guild_id, in_game_name")
    .in("id", memberIds);

  if (error) {
    console.error("Failed to load members for payroll batch", error);
    throw new ApiError(500, "Unable to load members");
  }

  const rows = (data ?? []) as MemberRow[];
  if (rows.length !== memberIds.length) {
    throw new ApiError(400, "validation error", {
      members: "one or more members are invalid",
    });
  }

  rows.forEach((row) => {
    if (row.guild_id !== guildId) {
      throw new ApiError(400, "validation error", {
        members: "member does not belong to this guild",
      });
    }
  });

  return new Map(rows.map((row) => [row.id, row]));
}

export async function createPayrollBatch(
  guildId: string,
  payload: CreatePayrollBatchPayload,
): Promise<PayrollBatchCreationResult> {
  if (!payload.members.length) {
    throw new ApiError(400, "validation error", { members: "at least one member is required" });
  }

  if (payload.totalAmount <= 0) {
    throw new ApiError(400, "validation error", { totalAmount: "total amount must be > 0" });
  }

  if (payload.periodFrom && payload.periodTo && payload.periodTo < payload.periodFrom) {
    throw new ApiError(400, "validation error", {
      periodTo: "periodTo must be greater than or equal to periodFrom",
    });
  }

  const memberIds = payload.members.map((member) => member.memberId);
  ensureMembersUnique(memberIds);
  await fetchMembers(guildId, memberIds);

  const { balance: availableBalance } = await getAvailableBalance(guildId, payload.source);
  if (payload.totalAmount - availableBalance > PERCENT_EPSILON) {
    throw new ApiError(400, "validation error", {
      totalAmount: "insufficient balance for the selected source",
    });
  }

  const allocations = computeAllocations({
    mode: payload.mode,
    totalAmount: payload.totalAmount,
    members: payload.members,
  });

  const calculatedTotal = allocations.reduce((acc, entry) => acc + entry.amount, 0);
  if (Math.abs(calculatedTotal - payload.totalAmount) > PERCENT_EPSILON) {
    throw new ApiError(400, "validation error", {
      members: "allocation mismatch detected",
    });
  }

  const referenceCode = buildReferenceCode();
  const balanceBefore = toCurrency(availableBalance);
  const balanceAfter = toCurrency(balanceBefore - payload.totalAmount);

  const { data: insertedBatch, error: batchError } = await supabaseAdmin
    .from("payroll_batches")
    .insert({
      guild_id: guildId,
      reference_code: referenceCode,
      source: payload.source,
      mode: payload.mode,
      period_from: payload.periodFrom ?? null,
      period_to: payload.periodTo ?? null,
      total_amount: toCurrency(payload.totalAmount),
      notes: payload.notes ?? null,
      distributed_by_user_id: payload.distributedByUserId,
      distributed_by_name: payload.distributedByName,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      members_count: allocations.length,
    })
    .select("*")
    .single();

  if (batchError || !insertedBatch) {
    console.error("Failed to insert payroll batch", batchError);
    throw new ApiError(500, "Unable to create payroll batch");
  }

  const batchId = insertedBatch.id as string;

  const itemsPayload = allocations.map((entry) => ({
    batch_id: batchId,
    member_id: entry.memberId,
    amount: toCurrency(entry.amount),
    percentage: entry.percentage !== undefined ? toCurrency(entry.percentage) : null,
  }));

  const { error: itemsError } = await supabaseAdmin.from("payroll_items").insert(itemsPayload);

  if (itemsError) {
    console.error("Failed to insert payroll items", itemsError);
    await supabaseAdmin.from("payroll_batches").delete().eq("id", batchId);
    throw new ApiError(500, "Unable to create payroll batch items");
  }

  await recordAuditLog(supabaseAdmin, {
    guildId,
    actorUserId: payload.distributedByUserId,
    action: "PAYROLL_BATCH_CREATED",
    metadata: {
      batch_id: batchId,
      reference_code: referenceCode,
      source: payload.source,
      total_amount: payload.totalAmount,
      mode: payload.mode,
      members: allocations.map((entry) => ({
        member_id: entry.memberId,
        amount: entry.amount,
        percentage: entry.percentage ?? null,
      })),
    },
  });

  return {
    batchId,
    referenceCode,
    totalAmount: toCurrency(payload.totalAmount),
    source: payload.source,
    balanceBefore,
    balanceAfter,
    createdAt: insertedBatch.created_at as string,
    distributedByName: payload.distributedByName,
  };
}

export async function listPayrollBatches(
  guildId: string,
  filters: PayrollListFilters,
): Promise<PayrollListResponse> {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(filters.pageSize ?? 20, 100);
  const { from, to } = getRange(page, pageSize);

  let restrictToBatchIds: string[] | undefined;
  if (filters.memberId) {
    const { data: batchMembershipRows, error: membershipError } = await supabaseAdmin
      .from("payroll_items")
      .select("batch_id")
      .eq("member_id", filters.memberId);

    if (membershipError) {
      console.error("Failed to load payroll items for member filter", membershipError);
      throw new ApiError(500, "Unable to load payroll batches");
    }

    const ids = Array.from(
      new Set((batchMembershipRows ?? []).map((row) => row.batch_id as string)),
    );

    if (ids.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    restrictToBatchIds = ids;
  }

  let query = supabaseAdmin
    .from("payroll_batches")
    .select(
      "id, guild_id, reference_code, source, mode, total_amount, members_count, distributed_by_name, distributed_by_user_id, balance_before, balance_after, created_at, updated_at, period_from, period_to, notes",
      { count: "exact" },
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.source) {
    query = query.eq("source", filters.source);
  }
  if (filters.distributedByUserId) {
    query = query.eq("distributed_by_user_id", filters.distributedByUserId);
  }
  if (filters.fromDate) {
    query = query.gte("created_at", filters.fromDate);
  }
  if (filters.toDate) {
    query = query.lte("created_at", filters.toDate);
  }
  if (restrictToBatchIds) {
    query = query.in("id", restrictToBatchIds);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to list payroll batches", error);
    throw new ApiError(500, "Unable to load payroll batches");
  }

  const items = (data ?? []).map((row) => {
    const batch = mapBatch(row);
    return {
      id: batch.id,
      referenceCode: batch.reference_code,
      source: batch.source,
      totalAmount: batch.total_amount,
      membersCount: batch.members_count,
      distributedByName: batch.distributed_by_name,
      createdAt: batch.created_at,
      periodFrom: batch.period_from,
      periodTo: batch.period_to,
      mode: batch.mode,
    };
  });

  const total = count ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return { items, total, page, pageSize, totalPages };
}

export async function getPayrollBatchDetail(
  guildId: string,
  batchId: string,
): Promise<PayrollBatchWithItems> {
  const { data: batchRow, error: batchError } = await supabaseAdmin
    .from("payroll_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();

  if (batchError) {
    console.error("Failed to load payroll batch", batchError);
    throw new ApiError(500, "Unable to load payroll batch");
  }

  if (!batchRow || batchRow.guild_id !== guildId) {
    throw new ApiError(404, "Payroll batch not found");
  }

  const { data: itemsRows, error: itemsError } = await supabaseAdmin
    .from("payroll_items")
    .select(
      "id, batch_id, member_id, amount, percentage, created_at, member:members!payroll_items_member_id_fkey(in_game_name)",
    )
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error("Failed to load payroll items", itemsError);
    throw new ApiError(500, "Unable to load payroll batch items");
  }

  const batch = mapBatch(batchRow);
  const items = (itemsRows ?? []).map(mapItem);

  return {
    ...batch,
    items,
  };
}
