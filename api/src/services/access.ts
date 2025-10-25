import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../errors.js";
import type { GuildRole } from "../types.js";

export async function requireGuildRole(
  client: SupabaseClient,
  userId: string,
  guildId: string,
  allowedRoles: GuildRole[],
): Promise<GuildRole> {
  const { data, error } = await client
    .from("guild_user_roles")
    .select("role")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load guild role", error);
    throw new ApiError(500, "Unable to verify guild role");
  }

  if (!data || !allowedRoles.includes(data.role as GuildRole)) {
    throw new ApiError(403, "Forbidden");
  }

  return data.role as GuildRole;
}
