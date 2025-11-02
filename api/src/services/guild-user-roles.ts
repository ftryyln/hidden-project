import { ApiError } from "../errors.js";
import { supabaseAdmin } from "../supabase.js";
import { recordAuditLog } from "./audit.js";
import { requireGuildRole, userIsSuperAdmin } from "./access.js";
import type { AssignmentSource, GuildRole, MemberRole, UserRole } from "../types.js";

export interface GuildUserRole {
  id: string;
  guild_id: string;
  user_id: string;
  role: GuildRole;
  assigned_at: string;
  assigned_by_user_id: string | null;
  revoked_at: string | null;
  source: AssignmentSource;
  user?: {
    email?: string;
    display_name?: string;
  };
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  super_admin: 900,
  guild_admin: 500,
  officer: 400,
  raider: 300,
  member: 200,
  viewer: 100,
};

function mapGuildRoleToMemberRole(role: GuildRole): MemberRole {
  switch (role) {
    case "guild_admin":
      return "leader";
    case "officer":
      return "officer";
    case "raider":
      return "raider";
    default:
      return "casual";
  }
}

async function ensureMemberRecord(guildId: string, userId: string, role: GuildRole): Promise<void> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.warn("Failed to verify member record for guild access assignment", existingError);
    return;
  }

  const memberRole = mapGuildRoleToMemberRole(role);

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .from("members")
      .update({ role_in_guild: memberRole, is_active: true })
      .eq("id", existing.id);

    if (updateError) {
      console.warn("Failed to update member role while syncing guild access", updateError);
    }
    return;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.warn("Failed to load profile when creating member from guild access", profileError);
  }

  const displayName = (profile?.display_name ?? profile?.email ?? "Guild member").trim();

  const { error: insertError } = await supabaseAdmin.from("members").insert({
    guild_id: guildId,
    user_id: userId,
    in_game_name: displayName || "Guild member",
    role_in_guild: memberRole,
    is_active: true,
  });

  if (insertError && insertError.code !== "23505") {
    console.warn("Failed to insert member record while syncing guild access", insertError);
  }
}

async function deactivateMemberIfNoAccess(guildId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select("id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .limit(1);

  if (error) {
    console.warn("Failed to check remaining guild access for member", error);
    return;
  }

  if (data && data.length > 0) {
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("members")
    .update({ is_active: false })
    .eq("guild_id", guildId)
    .eq("user_id", userId);

  if (updateError) {
    console.warn("Failed to deactivate member after access revocation", updateError);
  }
}

function highestRole(roles: UserRole[]): UserRole | null {
  if (roles.length === 0) {
    return null;
  }
  return roles.reduce<UserRole | null>((current, role) => {
    if (!current) {
      return role;
    }
    return ROLE_PRIORITY[role] > ROLE_PRIORITY[current] ? role : current;
  }, null);
}

async function countOtherGuildAdmins(guildId: string, excludeUserId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("role", "guild_admin")
    .is("revoked_at", null)
    .neq("user_id", excludeUserId);

  if (error) {
    console.error("Failed to count guild admins", error);
    throw new ApiError(500, "Unable to validate guild admin count");
  }

  return count ?? 0;
}

async function fetchActiveGuildRole(
  guildId: string,
  userId: string,
): Promise<(GuildUserRole & { role: GuildRole }) | null> {
  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select(
      "id, guild_id, user_id, role, assigned_at, assigned_by_user_id, revoked_at, source, profiles:profiles!guild_user_roles_user_id_fkey(display_name,email)",
    )
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to load guild role assignment", error);
    throw new ApiError(500, "Unable to load guild role assignment");
  }

  if (!data) {
    return null;
  }

  const profile = Array.isArray(data.profiles) ? data.profiles?.[0] : data.profiles;

  return {
    id: data.id as string,
    guild_id: data.guild_id as string,
    user_id: data.user_id as string,
    role: data.role as GuildRole,
    assigned_at: data.assigned_at as string,
    assigned_by_user_id: data.assigned_by_user_id ?? null,
    revoked_at: data.revoked_at ?? null,
    source: data.source as AssignmentSource,
    user: {
      email: profile?.email ?? undefined,
      display_name: profile?.display_name ?? undefined,
    },
  };
}

export async function listGuildUserRoles(guildId: string): Promise<GuildUserRole[]> {
  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .select(
      "id, guild_id, user_id, role, assigned_at, assigned_by_user_id, revoked_at, source, profiles:profiles!guild_user_roles_user_id_fkey(display_name,email)",
    )
    .eq("guild_id", guildId)
    .is("revoked_at", null)
    .order("assigned_at", { ascending: true });

  if (error) {
    console.error("Failed to list guild user roles", error);
    throw new ApiError(500, "Unable to load guild roles");
  }

  if (data && data.length > 0) {
    await Promise.allSettled(
      data.map((row) =>
        ensureMemberRecord(
          row.guild_id as string,
          row.user_id as string,
          row.role as GuildRole,
        ),
      ),
    );
  }

  return (
    data?.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles?.[0] : row.profiles;
      return {
        id: row.id as string,
        guild_id: row.guild_id as string,
        user_id: row.user_id as string,
        role: row.role as GuildRole,
        assigned_at: row.assigned_at as string,
        assigned_by_user_id: row.assigned_by_user_id ?? null,
        revoked_at: row.revoked_at ?? null,
        source: row.source as AssignmentSource,
        user: {
          email: profile?.email ?? undefined,
          display_name: profile?.display_name ?? undefined,
        },
      } satisfies GuildUserRole;
    }) ?? []
  );
}

export async function syncUserAppRole(userId: string): Promise<void> {
  const [{ data: profileData, error: profileError }, { data, error }] = await Promise.all([
    supabaseAdmin.from("profiles").select("app_role").eq("id", userId).maybeSingle(),
    supabaseAdmin
      .from("guild_user_roles")
      .select("role")
      .eq("user_id", userId)
      .is("revoked_at", null),
  ]);

  if (profileError) {
    console.warn("Failed to load profile app role while syncing", profileError);
  }

  if (error) {
    console.warn("Failed to load guild roles while syncing app role", error);
    return;
  }

  const currentAppRole = (profileData?.app_role as UserRole | null) ?? null;

  if (currentAppRole === "super_admin") {
    // Never downgrade a super admin automatically.
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { role: "super_admin" },
      });
    } catch (authError) {
      console.warn("Failed to ensure auth metadata for super admin", authError);
    }
    return;
  }

  const highest = highestRole(
    (data ?? []).map((row) => row.role as UserRole).filter(Boolean),
  );
  const nextRole: UserRole | null = highest ?? "viewer";

  await Promise.allSettled([
    supabaseAdmin
      .from("profiles")
      .update({ app_role: nextRole })
      .eq("id", userId),
    supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: nextRole },
    }),
  ]);
}

export async function assignGuildUserRole(
  guildId: string,
  userId: string,
  role: GuildRole,
  actorId: string,
  options: { source?: AssignmentSource; skipPermissionCheck?: boolean } = {},
): Promise<GuildUserRole> {
  const source: AssignmentSource = options.source ?? "manual";
  const skipPermissionCheck = options.skipPermissionCheck ?? false;

  // Require guild admin unless actor is super admin assigning themselves.
  if (!skipPermissionCheck && !(await userIsSuperAdmin(actorId))) {
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);
  }

  const existing = await fetchActiveGuildRole(guildId, userId);

  const downgradingFromAdmin =
    existing?.role === "guild_admin" && role !== "guild_admin";
  if (downgradingFromAdmin) {
    const otherAdmins = await countOtherGuildAdmins(guildId, userId);
    if (otherAdmins === 0) {
      throw new ApiError(400, "Cannot remove the last guild admin from this guild");
    }
  }

  if (existing && existing.role === role) {
    // Idempotent; still ensure metadata matches.
    await supabaseAdmin
      .from("guild_user_roles")
      .update({
        assigned_by_user_id: skipPermissionCheck ? existing.assigned_by_user_id ?? actorId : actorId,
        assigned_at: new Date().toISOString(),
        source,
        revoked_at: null,
      })
      .eq("id", existing.id);

    await syncUserAppRole(userId);
    await ensureMemberRecord(guildId, userId, role).catch((err) => {
      console.warn("Failed to sync member roster after guild role update", err);
    });

    return {
      ...existing,
      assigned_by_user_id: actorId,
      assigned_at: new Date().toISOString(),
      source,
    };
  }

  let assignmentId: string | null = existing?.id ?? null;
  const nowIso = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("guild_user_roles")
      .update({
        role,
      assigned_by_user_id: skipPermissionCheck ? existing?.assigned_by_user_id ?? actorId : actorId,
      assigned_at: nowIso,
      revoked_at: null,
      source,
    })
      .eq("id", existing.id)
      .select(
        "id, guild_id, user_id, role, assigned_at, assigned_by_user_id, revoked_at, source, profiles:profiles!guild_user_roles_user_id_fkey(display_name,email)",
      )
      .maybeSingle();

    if (error) {
      console.error("Failed to update guild user role", error);
      throw new ApiError(500, "Unable to update role");
    }

    if (!data) {
      throw new ApiError(500, "Role update returned no data");
    }

    assignmentId = data.id as string;

    await recordAuditLog(supabaseAdmin, {
      guildId,
      actorUserId: actorId,
      targetUserId: userId,
      action: "ROLE_REVOKED",
      metadata: {
        guild_id: guildId,
        user_id: userId,
        previous_role: existing.role,
        revoked_at: nowIso,
        source: existing.source,
      },
    });

    await recordAuditLog(supabaseAdmin, {
      guildId,
      actorUserId: actorId,
      targetUserId: userId,
      action: "ROLE_ASSIGNED",
      metadata: {
        guild_id: guildId,
        user_id: userId,
        role,
        source,
        previous_role: existing.role,
        assigned_at: nowIso,
      },
    });

    const profile = Array.isArray(data.profiles) ? data.profiles?.[0] : data.profiles;

    await syncUserAppRole(userId);

    return {
      id: data.id as string,
      guild_id: data.guild_id as string,
      user_id: data.user_id as string,
      role: data.role as GuildRole,
      assigned_at: data.assigned_at as string,
      assigned_by_user_id: data.assigned_by_user_id ?? null,
      revoked_at: data.revoked_at ?? null,
      source: data.source as AssignmentSource,
      user: {
        email: profile?.email ?? undefined,
        display_name: profile?.display_name ?? undefined,
      },
    };
  }

  const { data, error } = await supabaseAdmin
    .from("guild_user_roles")
    .insert({
      guild_id: guildId,
      user_id: userId,
      role,
      assigned_by_user_id: skipPermissionCheck ? actorId : actorId,
      assigned_at: nowIso,
      source,
      revoked_at: null,
    })
    .select(
      "id, guild_id, user_id, role, assigned_at, assigned_by_user_id, revoked_at, source, profiles:profiles!guild_user_roles_user_id_fkey(display_name,email)",
    )
    .maybeSingle();

  if (error) {
    console.error("Failed to assign guild user role", error);
    throw new ApiError(500, "Unable to assign role");
  }

  if (!data) {
    throw new ApiError(500, "Role assignment failed");
  }

  assignmentId = data.id as string;

  await recordAuditLog(supabaseAdmin, {
    guildId,
    actorUserId: actorId,
    targetUserId: userId,
    action: "ROLE_ASSIGNED",
    metadata: {
      guild_id: guildId,
      user_id: userId,
      role,
      source,
      assigned_at: nowIso,
    },
  });

  const profile = Array.isArray(data.profiles) ? data.profiles?.[0] : data.profiles;

  await syncUserAppRole(userId);
  await ensureMemberRecord(guildId, userId, role).catch((err) => {
    console.warn("Failed to sync member roster after guild role change", err);
  });

  return {
    id: assignmentId,
    guild_id: data.guild_id as string,
    user_id: data.user_id as string,
    role: data.role as GuildRole,
    assigned_at: data.assigned_at as string,
    assigned_by_user_id: data.assigned_by_user_id ?? null,
    revoked_at: data.revoked_at ?? null,
    source: data.source as AssignmentSource,
    user: {
      email: profile?.email ?? undefined,
      display_name: profile?.display_name ?? undefined,
    },
  };
}

export async function revokeGuildUserRole(
  guildId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  if (!(await userIsSuperAdmin(actorId))) {
    await requireGuildRole(supabaseAdmin, actorId, guildId, ["guild_admin"]);
  }

  const existing = await fetchActiveGuildRole(guildId, userId);
  if (!existing) {
    return;
  }

  if (existing.role === "guild_admin") {
    const otherAdmins = await countOtherGuildAdmins(guildId, userId);
    if (otherAdmins === 0) {
      throw new ApiError(400, "Cannot remove the last guild admin from this guild");
    }
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("guild_user_roles")
    .update({
      revoked_at: nowIso,
    })
    .eq("id", existing.id);

  if (error) {
    console.error("Failed to revoke guild user role", error);
    throw new ApiError(500, "Unable to revoke role");
  }

  await recordAuditLog(supabaseAdmin, {
    guildId,
    actorUserId: actorId,
    targetUserId: userId,
    action: "ROLE_REVOKED",
    metadata: {
      guild_id: guildId,
      user_id: userId,
      previous_role: existing.role,
      revoked_at: nowIso,
      source: existing.source,
    },
  });

  await syncUserAppRole(userId);
  await deactivateMemberIfNoAccess(guildId, userId).catch((err) => {
    console.warn("Failed to deactivate member after guild access removal", err);
  });
}
