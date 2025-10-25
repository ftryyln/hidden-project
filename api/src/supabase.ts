import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { config } from "./env.js";

if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
  console.warn(
    "Supabase client cannot be initialised without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

export const supabaseAdmin: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export const supabaseAuth: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey || config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export async function getUserFromToken(token: string): Promise<User | null> {
  if (!token) {
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}
