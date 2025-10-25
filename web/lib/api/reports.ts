import { api } from "@/lib/api";
import type { ReportsResponse } from "@/lib/types";
import { env } from "@/lib/env";

export interface ReportsParams {
  from?: string;
  to?: string;
}

export async function fetchReports(
  guildId: string,
  params: ReportsParams,
): Promise<ReportsResponse> {
  const { data } = await api.get<ReportsResponse>(`/guilds/${guildId}/reports`, {
    params,
  });
  return data;
}

export async function exportReportsCsv(
  guildId: string,
  resource: "members" | "transactions",
  params: ReportsParams,
): Promise<string> {
  const response = await api.post<string>(
    `/guilds/${guildId}/reports/export`,
    {
      resource,
      ...params,
    },
    {
      responseType: "text",
      transformResponse: (data) => data,
    },
  );
  return response.data;
}

export function getExportUrl(
  guildId: string,
  resource: "members" | "transactions",
  params: ReportsParams,
): string {
  const url = new URL(
    `/guilds/${guildId}/reports/export`,
    env.public.NEXT_PUBLIC_API_URL,
  );
  url.searchParams.set("resource", resource);
  if (params.from) {
    url.searchParams.set("from", params.from);
  }
  if (params.to) {
    url.searchParams.set("to", params.to);
  }
  return url.toString();
}
