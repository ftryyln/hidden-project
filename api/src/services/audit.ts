import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAuditLog(
  client: SupabaseClient,
  payload: {
    guildId: string;
    userId: string;
    action: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await client.from("audit_logs").insert({
    guild_id: payload.guildId,
    user_id: payload.userId,
    action: payload.action,
    payload: payload.data ?? {},
  });

  if (error) {
    console.error("Failed to record audit log", error);
  }
}
