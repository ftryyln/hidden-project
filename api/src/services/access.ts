import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type { GuildRole, UserRole } from "../types.js";

export async function userIsSuperAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .maybeSingle<{ app_role: UserRole | null }>();

  if (error) {
    console.error("Failed to check super admin status", error);
    return false;
  }

  return (data?.app_role as UserRole | null) === "super_admin";
}

export async function requireGuildRole(
  client: SupabaseClient,
  userId: string,
  guildId: string,
  allowedRoles: GuildRole[],
): Promise<GuildRole> {
  if (await userIsSuperAdmin(userId)) {
    return "guild_admin";
  }

  const { data, error } = await client
    .from("guild_user_roles")
    .select("role")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .is("revoked_at", null)
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
