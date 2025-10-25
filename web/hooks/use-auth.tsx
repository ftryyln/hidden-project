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
import { usePathname, useRouter } from "next/navigation";
import { login as loginRequest, logout as logoutRequest, fetchCurrentProfile } from "@/lib/api/auth";
import { onUnauthorized } from "@/lib/api";
import type { AuthProfile } from "@/lib/types";
import { toApiError, ApiClientError } from "@/lib/api/errors";

interface LoginDto {
  email: string;
  password: string;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthProfile | null;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(): Promise<AuthProfile | null> {
  try {
    const profile = await fetchCurrentProfile();
    return profile;
  } catch (error) {
    const apiError = await toApiError(error);
    if (apiError.status === 401) {
      return null;
    }
    throw apiError;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthProfile | null>(null);

  const publicRoutes = useMemo(
    () => new Set(["/login", "/register", "/forgot-password", "/reset-password"]),
    [],
  );

  const isPublicRoute = useCallback(
    (path: string | null) => {
      if (!path) return true;
      for (const route of publicRoutes) {
        if (path === route || path.startsWith(`${route}/`)) {
          return true;
        }
      }
      return false;
    },
    [publicRoutes],
  );

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
    if (!isPublicRoute(pathname)) {
      router.replace("/login");
    }
  }, [pathname, router, isPublicRoute]);

  const bootstrap = useCallback(async () => {
    setStatus("loading");
    try {
      const profile = await loadProfile();
      if (!profile) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }
      setUser(profile);
      setStatus("authenticated");
    } catch (error) {
      console.error("Failed to bootstrap session", error);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      handleUnauthorized();
    });
    return unsubscribe;
  }, [handleUnauthorized]);

  useEffect(() => {
    bootstrap().catch(() => {
      setStatus("unauthenticated");
    });
  }, [bootstrap]);

  const login = useCallback(
    async (dto: LoginDto) => {
      setStatus("loading");
      try {
        await loginRequest(dto);
        const profile = await loadProfile();
        if (!profile) {
          throw new ApiClientError(401, "Invalid session");
        }
        setUser(profile);
        setStatus("authenticated");
        router.replace("/dashboard");
      } catch (error) {
        const apiError = await toApiError(error);
        setUser(null);
        setStatus("unauthenticated");
        throw apiError;
      }
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch (error) {
      console.error("Failed to logout", error);
    } finally {
      handleUnauthorized();
    }
  }, [handleUnauthorized]);

  const refreshProfile = useCallback(async () => {
    const profile = await loadProfile();
    if (!profile) {
      handleUnauthorized();
      return;
    }
    setUser(profile);
    setStatus("authenticated");
  }, [handleUnauthorized]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      refreshProfile,
    }),
    [status, user, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
