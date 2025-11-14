import { apiClient, type ApiClientOptions } from "@/lib/apiClient";
import type {
  PayrollBatchDetail,
  PayrollBatchListItem,
  PayrollMode,
  PayrollMemberShare,
  PayrollSource,
  PayrollSummary,
} from "@/lib/types";

interface ApiEnvelope<T> {
  data: T;
  error: { code: number; message: string } | null;
}

interface PaginatedEnvelope<T> extends ApiEnvelope<T> {
  meta?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

function unwrap<T>(payload: ApiEnvelope<T>): T {
  if (payload.error) {
    throw new Error(payload.error.message);
  }
  return payload.data;
}

function assertNoError<T>(payload: PaginatedEnvelope<T>): PaginatedEnvelope<T> {
  if (payload.error) {
    throw new Error(payload.error.message);
  }
  return payload;
}

export interface PayrollListParams {
  page?: number;
  pageSize?: number;
  source?: PayrollSource;
  distributedByUserId?: string;
  memberId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface PayrollBatchCreationPayload {
  source: PayrollSource;
  mode: PayrollMode;
  totalAmount: number;
  periodFrom?: string | null;
  periodTo?: string | null;
  notes?: string | null;
  members: PayrollMemberShare[];
}

export interface PayrollBatchCreationResponse {
  batchId: string;
  referenceCode?: string | null;
  totalAmount: number;
  source: PayrollSource;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  distributedByName: string;
}

export async function fetchPayrollSummary(
  guildId: string,
  source: PayrollSource,
): Promise<PayrollSummary> {
  const payload = await apiClient<ApiEnvelope<PayrollSummary>>(
    `/guilds/${guildId}/payroll/summary`,
    {
      query: { source },
    },
  );
  return unwrap(payload);
}

export async function createPayrollBatch(
  guildId: string,
  body: PayrollBatchCreationPayload,
): Promise<PayrollBatchCreationResponse> {
  const payload = await apiClient<ApiEnvelope<PayrollBatchCreationResponse>>(
    `/guilds/${guildId}/payroll/batches`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return unwrap(payload);
}

export async function fetchPayrollBatches(
  guildId: string,
  params: PayrollListParams,
): Promise<{
  data: PayrollBatchListItem[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}> {
  const query: ApiClientOptions["query"] = {
    page: params.page,
    pageSize: params.pageSize,
    source: params.source,
    distributedByUserId: params.distributedByUserId,
    memberId: params.memberId,
    fromDate: params.fromDate,
    toDate: params.toDate,
  };
  const payload = await apiClient<PaginatedEnvelope<PayrollBatchListItem[]>>(
    `/guilds/${guildId}/payroll/batches`,
    {
      query,
    },
  );
  const result = assertNoError(payload);
  return {
    data: result.data,
    meta: result.meta ?? {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
      totalItems: result.data.length,
      totalPages: 1,
    },
  };
}

export async function fetchPayrollBatchDetail(
  guildId: string,
  batchId: string,
): Promise<PayrollBatchDetail> {
  const payload = await apiClient<ApiEnvelope<PayrollBatchDetail>>(
    `/guilds/${guildId}/payroll/batches/${batchId}`,
  );
  return unwrap(payload);
}
