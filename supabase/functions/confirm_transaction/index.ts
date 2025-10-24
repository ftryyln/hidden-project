import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { errorResponse, successResponse } from "../_shared/response.ts";
import {
  requireGuildRole,
  requireUser,
  supabaseAdmin,
} from "../_shared/supabase.ts";
import { ensureUuid, readJsonBody } from "../_shared/validation.ts";

interface ConfirmTransactionInput {
  transaction_id: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) {
    return auth;
  }

  const parsed = await readJsonBody<ConfirmTransactionInput>(req);
  if (parsed instanceof Response) {
    return parsed;
  }

  const transactionId = ensureUuid(parsed.data.transaction_id, "transaction_id");
  if (transactionId instanceof Response) {
    return transactionId;
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("id, guild_id, confirmed")
    .eq("id", transactionId)
    .maybeSingle();

  if (txError) {
    console.error("Failed to load transaction", txError);
    return errorResponse(500, "Unable to load transaction");
  }

  if (!transaction) {
    return errorResponse(404, "Transaction not found");
  }

  const roleCheck = await requireGuildRole(
    supabaseAdmin,
    auth.user.id,
    transaction.guild_id,
    ["guild_admin", "officer"],
  );
  if (roleCheck instanceof Response) {
    return roleCheck;
  }

  if (transaction.confirmed) {
    return errorResponse(400, "Transaction already confirmed");
  }

  const confirmedAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      confirmed: true,
      confirmed_by: auth.user.id,
      confirmed_at: confirmedAt,
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("Failed to confirm transaction", updateError);
    return errorResponse(500, "Unable to confirm transaction");
  }

  const { error: auditError } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      guild_id: transaction.guild_id,
      user_id: auth.user.id,
      action: "transaction.confirmed",
      payload: {
        transaction_id: transactionId,
        confirmed_at: confirmedAt,
      },
    });

  if (auditError) {
    console.error("Failed to write audit log", auditError);
  }

  return successResponse(200, {
    transaction_id: transactionId,
    confirmed_at: confirmedAt,
  });
});
