import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { requireGuildRole } from "./access.js";

export type GuildRole = "guild_admin" | "officer" | "raider" | "member" | "viewer";

const ROLE_PRIORITY: Record<GuildRole, number> = {
  guild_admin: 500,
  officer: 400,
  raider: 300,
  member: 200,
  viewer: 100,
};

export interface GuildUserRole {
  guild_id: string;
  user_id: string;
  role: GuildRole;
  user?: {
    email?: string;
    display_name?: string;
  };
}

export async function syncUserAppRole(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.warn("Failed to load guild roles while syncing app role", error);
    return;
  }

  const highest = (data ?? []).reduce<GuildRole | null>((current, row) => {
    const role = row.role as GuildRole;
    if (!current) {
      return role;
    }
    return ROLE_PRIORITY[role] > ROLE_PRIORITY[current] ? role : current;
  }, null);

  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: highest ?? null },
    });
  } catch (authError) {
    console.warn("Failed to update user app_metadata role", authError);
  }
}

export async function listGuildUserRoles(guildId: string): Promise<GuildUserRole[]> {
  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select(
      "guild_id, user_id, role, profiles:profiles!guild_user_roles_user_id_fkey(display_name, email)",
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to list guild user roles", error);
    throw new ApiError(500, "Unable to load guild roles");
  }

  return (
    data?.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles?.[0] : row.profiles;
      return {
        guild_id: row.guild_id as string,
        user_id: row.user_id,
        role: row.role as GuildRole,
        user: {
          email: profile?.email ?? undefined,
          display_name: profile?.display_name ?? undefined,
        },
      };
    }) ?? []
  );
}

export async function updateGuildUserRole(
  guildId: string,
  userId: string,
  role: GuildRole,
  actorId: string,
): Promise<GuildUserRole> {
  await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);

  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .update({ role })
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .select(
      "guild_id, user_id, role, profiles:profiles!guild_user_roles_user_id_fkey(display_name, email)",
    )
    .maybeSingle();

  if (error) {
    console.error("Failed to update guild user role", error);
    throw new ApiError(500, "Unable to update role");
  }

  if (!data) {
    throw new ApiError(404, "Guild member not found");
  }

  const profile = Array.isArray(data.profiles) ? data.profiles?.[0] : data.profiles;

  await syncUserAppRole(userId);

  return {
    guild_id: data.guild_id as string,
    user_id: data.user_id,
    role: data.role as GuildRole,
    user: {
      email: profile?.email ?? undefined,
      display_name: profile?.display_name ?? undefined,
    },
  };
}
