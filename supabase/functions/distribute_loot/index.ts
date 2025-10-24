import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { errorResponse, successResponse } from "../_shared/response.ts";
import {
  requireGuildRole,
  requireUser,
  supabaseAdmin,
} from "../_shared/supabase.ts";
import { ensureUuid, readJsonBody } from "../_shared/validation.ts";

interface DistributionInput {
  member_id: string;
  share_amount: number;
}

interface DistributeLootInput {
  loot_id: string;
  distributions: DistributionInput[];
  create_transactions?: boolean;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) {
    return auth;
  }

  const parsed = await readJsonBody<DistributeLootInput>(req);
  if (parsed instanceof Response) {
    return parsed;
  }
  const { loot_id, distributions, create_transactions = true } = parsed.data;

  const lootId = ensureUuid(loot_id, "loot_id");
  if (lootId instanceof Response) {
    return lootId;
  }

  if (!Array.isArray(distributions) || distributions.length === 0) {
    return errorResponse(400, "validation error", {
      distributions: "must include at least one entry",
    });
  }

  const memberIds = new Set<string>();
  let totalShare = 0;
  for (const item of distributions) {
    const memberId = ensureUuid(item.member_id, "member_id");
    if (memberId instanceof Response) {
      return memberId;
    }
    if (typeof item.share_amount !== "number" || item.share_amount < 0) {
      return errorResponse(400, "validation error", {
        share_amount: "must be a non-negative number",
      });
    }
    memberIds.add(memberId);
    totalShare += item.share_amount;
  }

  const { data: loot, error: lootError } = await supabaseAdmin
    .from("loot_records")
    .select("id, guild_id, estimated_value, distributed, item_name")
    .eq("id", lootId)
    .maybeSingle();

  if (lootError) {
    console.error("Failed to load loot record", lootError);
    return errorResponse(500, "Unable to load loot record");
  }

  if (!loot) {
    return errorResponse(404, "Loot record not found");
  }

  if (loot.distributed) {
    return errorResponse(400, "Loot already distributed");
  }

  if (totalShare > loot.estimated_value + 0.0001) {
    return errorResponse(400, "validation error", {
      share_amount: "total share exceeds estimated value",
    });
  }

  const roleCheck = await requireGuildRole(
    supabaseAdmin,
    auth.user.id,
    loot.guild_id,
    ["guild_admin", "officer"],
  );
  if (roleCheck instanceof Response) {
    return roleCheck;
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("members")
    .select("id, guild_id, in_game_name")
    .in("id", Array.from(memberIds));

  if (membersError) {
    console.error("Failed to load member roster", membersError);
    return errorResponse(500, "Unable to load members");
  }

  if ((members?.length ?? 0) !== memberIds.size) {
    return errorResponse(400, "validation error", {
      member_id: "one or more members do not exist",
    });
  }

  for (const member of members ?? []) {
    if (member.guild_id !== loot.guild_id) {
      return errorResponse(400, "validation error", {
        member_id: "member does not belong to the loot guild",
      });
    }
  }

  const memberNameById = new Map<string, string>();
  members?.forEach((m) => memberNameById.set(m.id, m.in_game_name));

  const insertPayload = distributions.map((entry) => ({
    loot_id: lootId,
    member_id: entry.member_id,
    share_amount: entry.share_amount,
  }));

  const { error: deleteError } = await supabaseAdmin
    .from("loot_distribution")
    .delete()
    .eq("loot_id", lootId);
  if (deleteError) {
    console.error("Failed to reset previous distribution", deleteError);
    return errorResponse(500, "Unable to reset distribution");
  }

  const { error: insertError } = await supabaseAdmin
    .from("loot_distribution")
    .insert(insertPayload);
  if (insertError) {
    console.error("Failed to insert distribution rows", insertError);
    return errorResponse(500, "Unable to persist distribution");
  }

  const nowIso = new Date().toISOString();
  const { error: updateLootError } = await supabaseAdmin
    .from("loot_records")
    .update({ distributed: true, distributed_at: nowIso })
    .eq("id", lootId);

  if (updateLootError) {
    console.error("Failed to update loot record", updateLootError);
    return errorResponse(500, "Unable to mark loot as distributed");
  }

  let createdTransactions = 0;
  if (create_transactions) {
    const txPayload = distributions.map((entry) => ({
      guild_id: loot.guild_id,
      created_by: auth.user.id,
      tx_type: "expense",
      category: "loot_distribution",
      amount: entry.share_amount,
      description: `Loot distribution for ${loot.item_name} -> ${memberNameById.get(entry.member_id) ?? entry.member_id}`,
      confirmed: false,
    }));

    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert(txPayload);
    if (txError) {
      console.error("Failed to insert companion transactions", txError);
    } else {
      createdTransactions = txPayload.length;
    }
  }

  const auditPayload = {
    loot_id: lootId,
    item_name: loot.item_name,
    total_share: totalShare,
    distributions: distributions.map((d) => ({
      member_id: d.member_id,
      share_amount: d.share_amount,
      member_name: memberNameById.get(d.member_id),
    })),
    created_transactions,
  };

  const { error: auditError } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      guild_id: loot.guild_id,
      user_id: auth.user.id,
      action: "loot.distributed",
      payload: auditPayload,
    });

  if (auditError) {
    console.error("Failed to write audit log", auditError);
  }

  return successResponse(200, {
    loot_id: lootId,
    total_share: totalShare,
    created_transactions,
  });
});
