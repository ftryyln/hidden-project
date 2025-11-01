"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GuildSwitcher } from "@/components/guild/guild-switcher";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { UserMenu } from "@/components/navigation/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardGuildProvider } from "@/components/dashboard/dashboard-guild-context";

const STORAGE_KEY = "guild-manager:selected-guild";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);

  const guildFromPath = useMemo(() => {
    const match = pathname?.match(/\/guilds\/([^/]+)/);
    if (match && match[1] !== "select") {
      return match[1];
    }
    return null;
  }, [pathname]);

  useEffect(() => {
    if (!guildFromPath || guildFromPath === selectedGuild) {
      return;
    }
    setSelectedGuild(guildFromPath);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, guildFromPath);
    }
  }, [guildFromPath, selectedGuild]);

  useEffect(() => {
    if (guildFromPath || selectedGuild) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedGuild(stored);
    }
  }, [guildFromPath, selectedGuild]);

  const handleGuildChange = useCallback(
    (guildId: string) => {
      setSelectedGuild(guildId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, guildId);
      }
      if (pathname?.startsWith("/guilds/")) {
        const remainder = pathname.replace(/\/guilds\/[^/]+/, "");
        router.push(`/guilds/${guildId}${remainder}`);
      } else {
        if (pathname !== "/dashboard") {
          router.push("/dashboard");
        }
      }
    },
    [pathname, router],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSuperAdmin = user?.app_role === "super_admin";
  const mobileMenuExtras = (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Selected guild
        </span>
        <GuildSwitcher
          value={selectedGuild}
          onChange={handleGuildChange}
          className="w-full"
        />
      </div>
      <div className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Profile
        </span>
        <UserMenu
          showDetails
          buttonProps={{
            variant: "outline",
            size: "default",
            className:
              "w-full justify-between rounded-2xl border-border/60 bg-muted/30 px-4 py-2 text-sm font-medium",
          }}
        />
      </div>
    </div>
  );

  return (
    <DashboardGuildProvider value={{ selectedGuild, changeGuild: handleGuildChange }}>
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
          <div className="container flex flex-col gap-3 py-4">
            <div className="flex items-center gap-3 md:gap-4">
              <h1 className="text-xl font-bold tracking-tight">Guild Manager</h1>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <ThemeToggle className="shrink-0" />
                <DashboardNav
                  guildId={selectedGuild}
                  isSuperAdmin={isSuperAdmin}
                  mobileExtras={mobileMenuExtras}
                />
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex md:justify-end">
              <GuildSwitcher
                value={selectedGuild}
                onChange={handleGuildChange}
                className="w-full max-w-xs sm:max-w-sm"
              />
              <UserMenu
                buttonProps={{
                  size: "default",
                  className: "rounded-full px-3",
                }}
              />
            </div>
          </div>
        </header>
        <main className="container flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </DashboardGuildProvider>
  );
}
