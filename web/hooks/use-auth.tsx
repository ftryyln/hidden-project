"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onUnauthorized, setAccessToken } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import type { Session } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role?: "guild_admin" | "officer" | "member" | "viewer";
}

interface LoginDto {
  email: string;
  password: string;
}

export interface AuthContextValue {
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
  token: string | null;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    setAccessToken(null);
    if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/guilds")) {
      router.replace("/login");
    }
  }, [pathname, router]);

  const applySession = useCallback(
    async (session: Session | null) => {
      if (!session) {
        signOut();
        return;
      }

      try {
        setStatus("loading");
        setAccessToken(session.access_token);
        setToken(session.access_token);

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.warn("Failed to load profile from database, falling back to auth metadata.", error);
        }

        const resolvedProfile = profile ?? {
          id: session.user.id,
          email: session.user.email ?? "",
          display_name:
            (session.user.user_metadata as Record<string, string> | undefined)?.display_name ??
            session.user.email ??
            "",
        };

        setUser({
          id: resolvedProfile.id,
          email: resolvedProfile.email ?? session.user.email ?? "",
          display_name:
            resolvedProfile.display_name ?? session.user.email ?? resolvedProfile.email ?? "",
          role: (session.user.app_metadata?.role as AuthUser["role"]) ?? undefined,
        });
        setStatus("authenticated");
      } catch (error) {
        console.error("Failed to apply session", error);
        setAccessToken(null);
        setToken(null);
        setUser(null);
        setStatus("unauthenticated");
        if (pathname !== "/login") {
          router.replace("/login");
        }
      }
    },
    [pathname, router, signOut],
  );

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session ?? null);
  }, [applySession]);

  const login = useCallback(
    async (dto: LoginDto) => {
      const { data, error } = await supabase.auth.signInWithPassword(dto);
      if (error || !data.session) {
        setStatus("unauthenticated");
        throw { message: error?.message ?? "Unable to sign in with provided credentials." };
      }
      await applySession(data.session);
      router.replace("/dashboard");
    },
    [applySession, router],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    signOut();
  }, [signOut]);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    onUnauthorized(() => {
      void signOut();
    });
  }, [signOut]);

  useEffect(() => {
    loadProfile().catch(() => {
      setStatus("unauthenticated");
    });
  }, [loadProfile]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });
    return () => subscription.unsubscribe();
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      token,
      login,
      logout,
      refreshProfile,
    }),
    [status, user, token, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
