import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { errorResponse } from "../_shared/response.ts";
import {
  requireGuildRole,
  requireUser,
  supabaseAdmin,
} from "../_shared/supabase.ts";
import { ensureEnum, ensureUuid, readJsonBody } from "../_shared/validation.ts";

interface DateRangeInput {
  from?: string;
  to?: string;
}

interface ExportCsvInput {
  guild_id: string;
  resource: "members" | "transactions";
  date_range?: DateRangeInput;
}

type CsvRow = Record<string, string | number | boolean | null>;

function toCsv(rows: CsvRow[], columns: string[]): string {
  const escape = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    if (/["\r\n,]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const header = columns.join(",");
  const dataLines = rows.map((row) =>
    columns.map((col) => escape(row[col] ?? "")).join(",")
  );
  return [header, ...dataLines].join("\r\n");
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) {
    return auth;
  }

  const parsed = await readJsonBody<ExportCsvInput>(req);
  if (parsed instanceof Response) {
    return parsed;
  }

  const guildId = ensureUuid(parsed.data.guild_id, "guild_id");
  if (guildId instanceof Response) {
    return guildId;
  }

  const resource = ensureEnum(parsed.data.resource, ["members", "transactions"], "resource");
  if (resource instanceof Response) {
    return resource;
  }

  const roleCheck = await requireGuildRole(
    supabaseAdmin,
    auth.user.id,
    guildId,
    ["guild_admin", "officer"],
  );
  if (roleCheck instanceof Response) {
    return roleCheck;
  }

  const dateRange = parsed.data.date_range;
  const fromDate = dateRange?.from ? new Date(dateRange.from) : undefined;
  const toDate = dateRange?.to ? new Date(dateRange.to) : undefined;

  if (fromDate && isNaN(fromDate.getTime())) {
    return errorResponse(400, "validation error", {
      date_range: "invalid from date",
    });
  }
  if (toDate && isNaN(toDate.getTime())) {
    return errorResponse(400, "validation error", {
      date_range: "invalid to date",
    });
  }

  if (fromDate && toDate && fromDate > toDate) {
    return errorResponse(400, "validation error", {
      date_range: "'from' must be before 'to'",
    });
  }

  let csv = "";
  let fileName = `${resource}-${guildId}-${Date.now()}.csv`;

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
      return errorResponse(500, "Unable to export members");
    }

    const rows: CsvRow[] = (data ?? []).map((member) => ({
      member_id: member.id,
      in_game_name: member.in_game_name,
      role_in_guild: member.role_in_guild,
      join_date: member.join_date ?? "",
      is_active: member.is_active,
      contact: member.contact ? JSON.stringify(member.contact) : "",
      notes: member.notes ?? "",
      created_at: member.created_at,
    }));

    const columns = [
      "member_id",
      "in_game_name",
      "role_in_guild",
      "join_date",
      "is_active",
      "contact",
      "notes",
      "created_at",
    ];

    csv = toCsv(rows, columns);
  } else {
    let query = supabaseAdmin
      .from("transactions")
      .select("id, created_at, tx_type, category, amount, description, confirmed, confirmed_at, created_by, evidence_path")
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
      return errorResponse(500, "Unable to export transactions");
    }

    const rows: CsvRow[] = (data ?? []).map((tx) => ({
      transaction_id: tx.id,
      created_at: tx.created_at,
      tx_type: tx.tx_type,
      category: tx.category,
      amount: Number(tx.amount ?? 0).toFixed(2),
      description: tx.description ?? "",
      confirmed: tx.confirmed,
      confirmed_at: tx.confirmed_at ?? "",
      created_by: tx.created_by,
      evidence_path: tx.evidence_path ?? "",
    }));

    const columns = [
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
    ];

    csv = toCsv(rows, columns);
  }

  const headers = new Headers({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  });

  return new Response(csv, { status: 200, headers });
});
