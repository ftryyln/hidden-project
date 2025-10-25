import type { AuthProfile, AuthUser, GuildRoleAssignment } from "@/lib/types";
import { api } from "@/lib/api";
import { toApiError } from "./errors";

const ROLE_PRIORITY = ["guild_admin", "officer", "raider", "member", "viewer"] as const;

function resolveEffectiveRole(profile: AuthProfile): AuthProfile {
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
