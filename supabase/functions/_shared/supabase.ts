import { createClient, SupabaseClient, User } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "./response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("SUPABASE_API_URL") ??
  "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL) {
  console.warn("SUPABASE_URL env var is missing for Edge Function.");
}
if (!SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY env var is missing for Edge Function.");
}

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface AuthContext {
  user: User;
  accessToken: string;
}

export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or invalid authorization header");
  }

  const accessToken = authHeader.replace("Bearer", "").trim();
  if (!accessToken) {
    return errorResponse(401, "Missing or invalid access token");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    console.error("Failed to resolve user from access token", error);
    return errorResponse(401, "Unauthorized");
  }

  return { user: data.user, accessToken };
}

export async function requireGuildRole(
  client: SupabaseClient,
  userId: string,
  guildId: string,
  allowedRoles: Array<"guild_admin" | "officer" | "raider" | "member" | "viewer">,
): Promise<{ role: "guild_admin" | "officer" | "raider" | "member" | "viewer" } | Response> {
  const { data, error } = await client
    .from("guild_user_roles")
    .select("role")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load guild role", error);
    return errorResponse(500, "Unable to verify guild role");
  }

  if (!data || !allowedRoles.includes(data.role)) {
    return errorResponse(403, "Forbidden");
  }

  return { role: data.role };
}
