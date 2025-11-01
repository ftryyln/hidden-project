import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import type { GuildRole, UserRole } from "../types.js";
import { assignGuildUserRole, revokeGuildUserRole } from "./guild-user-roles.js";

export interface AdminUserGuildAssignment {
  guild_id: string;
  guild_name: string;
  guild_tag: string;
  role: GuildRole;
}

export interface AdminUserSummary {
  id: string;
  email: string | null;
  display_name: string | null;
  app_role: UserRole | null;
  created_at: string | null;
  guilds: AdminUserGuildAssignment[];
}

async function ensureUserExists(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify user existence", error);
    throw new ApiError(500, "Unable to verify user");
  }

  if (!data) {
    throw new ApiError(404, "User not found");
  }
}

type GuildRecord = { id: string; name: string | null; tag: string | null };

async function ensureGuildExists(guildId: string): Promise<GuildRecord> {
  const { data, error } = await supabaseAdmin
    .from("guilds")
    .select("id, name, tag")
    .eq("id", guildId)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify guild existence", error);
    throw new ApiError(500, "Unable to verify guild");
  }

  if (!data) {
    throw new ApiError(404, "Guild not found");
  }

  return {
    id: data.id as string,
    name: data.name ?? null,
    tag: data.tag ?? null,
  };
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, display_name, app_role, created_at")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("guild_user_roles")
        .select("user_id, guild_id, role, revoked_at, guilds(name, tag)")
        .is("revoked_at", null),
    ]);

  if (profileError) {
    console.error("Failed to load users", profileError);
    throw new ApiError(500, "Unable to load users");
  }

  if (roleError) {
    console.error("Failed to load user guild assignments", roleError);
    throw new ApiError(500, "Unable to load user guild assignments");
  }

  const assignments = new Map<string, AdminUserGuildAssignment[]>();

  if (roles) {
    for (const row of roles) {
      const guild = Array.isArray(row.guilds) ? row.guilds?.[0] : row.guilds;

      assignments.set(row.user_id as string, [
        ...(assignments.get(row.user_id as string) ?? []),
        {
          guild_id: row.guild_id as string,
          guild_name: guild?.name ?? "Unknown guild",
          guild_tag: guild?.tag ?? "",
          role: row.role as GuildRole,
        },
      ]);
    }
  }

  return (
    profiles?.map((profile) => ({
      id: profile.id as string,
      email: profile.email ?? null,
      display_name: profile.display_name ?? null,
      app_role: (profile.app_role ?? null) as UserRole | null,
      created_at: profile.created_at ?? null,
      guilds: assignments.get(profile.id as string) ?? [],
    })) ?? []
  );
}

export async function assignUserToGuild(
  actorId: string,
  userId: string,
  guildId: string,
  role: GuildRole,
) {
  await ensureUserExists(userId);
  const guild = await ensureGuildExists(guildId);
  const assignment = await assignGuildUserRole(guildId, userId, role, actorId, {
    source: "manual",
    skipPermissionCheck: true,
  });
  return {
    guild_id: assignment.guild_id,
    guild_name: guild.name ?? "Unknown guild",
    guild_tag: guild.tag ?? "",
    role: assignment.role,
  };
}

export async function removeUserFromGuild(actorId: string, userId: string, guildId: string) {
  await ensureUserExists(userId);
  await ensureGuildExists(guildId);
  await revokeGuildUserRole(guildId, userId, actorId);
}

export async function deleteAdminUser(actorId: string, userId: string): Promise<void> {
  if (actorId === userId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  await ensureUserExists(userId);

  const { data: activeAssignments, error: assignmentError } = await supabaseAdmin
    .from("guild_user_roles")
    .select("guild_id")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (assignmentError) {
    console.error("Failed to load user guild assignments before deletion", assignmentError);
    throw new ApiError(500, "Unable to delete user");
  }

  if (activeAssignments) {
    for (const assignment of activeAssignments) {
      try {
        await revokeGuildUserRole(assignment.guild_id as string, userId, actorId);
      } catch (error) {
        console.error("Failed to revoke guild role during user deletion", error);
      }
    }
  }

  const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileDeleteError) {
    console.error("Failed to delete profile", profileDeleteError);
    throw new ApiError(500, "Unable to delete user profile");
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (authDeleteError && authDeleteError.message !== "User not found") {
    console.error("Failed to delete auth user", authDeleteError);
    throw new ApiError(500, "Unable to delete user account");
  }
}
