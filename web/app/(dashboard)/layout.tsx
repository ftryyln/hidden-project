"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GuildSwitcher } from "@/components/guild/guild-switcher";
import { DashboardNav, DashboardMobileNav } from "@/components/navigation/dashboard-nav";
import { UserMenu } from "@/components/navigation/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardGuildProvider } from "@/components/dashboard/dashboard-guild-context";

const STORAGE_KEY = "guild-manager:selected-guild";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);

  // Ambil guild id dari URL: /guilds/<gid>/...
  const guildFromPath = useMemo(() => {
    const match = pathname?.match(/\/guilds\/([^/]+)/);
    if (match && match[1] !== "select") return match[1];
    return null;
  }, [pathname]);

  // Jika URL mengandung guild, pakai itu dan persist.
  useEffect(() => {
    if (!guildFromPath || guildFromPath === selectedGuild) return;
    setSelectedGuild(guildFromPath);
    try {
      window.localStorage.setItem(STORAGE_KEY, guildFromPath);
    } catch { }
  }, [guildFromPath, selectedGuild]);

  // Saat pertama kali (tanpa guild di URL), restore dari localStorage.
  useEffect(() => {
    if (guildFromPath || selectedGuild) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedGuild(stored);
    } catch { }
  }, [guildFromPath, selectedGuild]);

  const handleGuildChange = useCallback(
    (guildId: string) => {
      setSelectedGuild(guildId);
      try {
        window.localStorage.setItem(STORAGE_KEY, guildId);
      } catch { }

      if (pathname?.startsWith("/guilds/")) {
        // Ganti hanya segmen guild-nya; sisanya tetap.
        const remainder = pathname.replace(/\/guilds\/[^/]+/, "");
        router.push(`/guilds/${guildId}${remainder}`);
      } else if (pathname !== "/dashboard") {
        router.push("/dashboard");
      }
    },
    [pathname, router],
  );

  // Redirect bila belum login
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSuperAdmin = user?.app_role === "super_admin";

  return (
    <DashboardGuildProvider value={{ selectedGuild, changeGuild: handleGuildChange }}>
      <div className="flex min-h-screen flex-col bg-background">
        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
          <div className="container flex flex-col gap-3 py-4">
            <div className="flex items-center gap-2">
              <DashboardMobileNav
                guildId={selectedGuild}
                isSuperAdmin={isSuperAdmin}
                triggerClassName="bg-muted/30"
              />

              <Link
                href="/dashboard"
                className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
              >
                Guild Manager
              </Link>

              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle
                  variant="outline"
                  size="icon"
                  className="rounded-full border-border/60 text-foreground"
                />
                <UserMenu showDetails={false} buttonProps={{ className: "rounded-full border-border/60" }} />
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
              <GuildSwitcher
                value={selectedGuild}
                onChange={handleGuildChange}
                className="min-w-[200px] lg:w-60"
              />
              <div className="flex w-full justify-center">
                <DashboardNav
                  guildId={selectedGuild}
                  isSuperAdmin={isSuperAdmin}
                  className="max-w-5xl w-full justify-center"
                />
              </div>
              <div className="hidden lg:block lg:w-60" />
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="container flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </DashboardGuildProvider>
  );
}
