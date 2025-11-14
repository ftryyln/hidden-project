
import type { AuthProfile, AuthUser, GuildRoleAssignment, GuildRole } from "@/lib/types";
import { api } from "@/lib/api";
import { toApiError } from "./errors";

const ROLE_PRIORITY: GuildRole[] = ["guild_admin", "officer", "raider", "member", "viewer"];

function resolveEffectiveRole(profile: AuthProfile): AuthProfile {
  if (profile.app_role === "super_admin") {
    return profile;
  }

  if (!profile.guild_roles?.length) {
    return {
      ...profile,
      app_role: profile.app_role ?? null,
    };
  }
  const highest = profile.guild_roles
    .map((assignment: GuildRoleAssignment) => assignment.role)
    .sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b))[0];

  return {
    ...profile,
    app_role: profile.app_role ?? highest ?? null,
  };
}

interface LoginPayload {
  email: string;
  password: string;
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export async function refreshSession(): Promise<void> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export async function fetchCurrentProfile(): Promise<AuthProfile> {
  const { data } = await api.get<AuthProfile>("/auth/me");
  return resolveEffectiveRole(data);
}

export async function updateProfileName(displayName: string): Promise<void> {
  await api.patch("/auth/profile", { display_name: displayName });
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.post("/auth/change-password", {
    current_password: payload.currentPassword,
    new_password: payload.newPassword,
  });
}

export async function acceptInvite(token: string): Promise<{ guild_id: string; role: GuildRole }> {
  const { data } = await api.post<{ guild_id: string; role: GuildRole }>("/auth/accept-invite", {
    token,
  });
  return data;
}
