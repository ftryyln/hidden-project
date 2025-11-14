"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GuildSwitcher } from "@/components/guild/guild-switcher";
import { DashboardNav, DashboardMobileNav } from "@/components/navigation/dashboard-nav";
import { UserMenu } from "@/components/navigation/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardGuildProvider } from "@/components/dashboard/dashboard-guild-context";
import { CommunitySidebar } from "@/components/community/community-sidebar";

const STORAGE_KEY = "guild-manager:selected-guild";
const SIDEBAR_WIDTH = 320;
const SIDEBAR_GUTTER = 32;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);
  const mainShellRef = useRef<HTMLDivElement | null>(null);
  const [sidebarLeft, setSidebarLeft] = useState<number>(SIDEBAR_GUTTER);

  // Extract guild id from the current path: /guilds/<gid>/...
  const guildFromPath = useMemo(() => {
    const match = pathname?.match(/\/guilds\/([^/]+)/);
    if (match && match[1] !== "select") return match[1];
    return null;
  }, [pathname]);

  // When the URL already has a guild segment, honor it and persist locally.
  useEffect(() => {
    if (!guildFromPath || guildFromPath === selectedGuild) return;
    setSelectedGuild(guildFromPath);
    try {
      window.localStorage.setItem(STORAGE_KEY, guildFromPath);
    } catch { }
  }, [guildFromPath, selectedGuild]);

  // On first load without a guild in the URL, restore from localStorage.
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
        // Swap only the guild segment and keep the rest of the path intact.
        const remainder = pathname.replace(/\/guilds\/[^/]+/, "");
        router.push(`/guilds/${guildId}${remainder}`);
      } else if (pathname !== "/dashboard") {
        router.push("/dashboard");
      }
    },
    [pathname, router],
  );

  // Redirect when the user is not authenticated.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    const updateSidebarPosition = () => {
      if (!mainShellRef.current) return;
      const rect = mainShellRef.current.getBoundingClientRect();
      setSidebarLeft(rect.left);
    };

    updateSidebarPosition();
    window.addEventListener("resize", updateSidebarPosition);
    return () => window.removeEventListener("resize", updateSidebarPosition);
  }, []);

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
        <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
          <div className="container flex flex-col gap-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DashboardMobileNav
                  guildId={selectedGuild}
                  isSuperAdmin={isSuperAdmin}
                  triggerClassName="bg-muted/30"
                  mobileExtras={
                    <UserMenu appearance="sidebar" showDetails className="w-full" />
                  }
                />

                <Link
                  href="/dashboard"
                  className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                >
                  Guild Manager
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:flex-none">
                <GuildSwitcher
                  value={selectedGuild}
                  onChange={handleGuildChange}
                  className="min-w-[200px] sm:w-72 lg:w-80"
                />
                <ThemeToggle
                  variant="outline"
                  size="icon"
                  className="rounded-full border-border/60 text-foreground"
                />
              </div>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="flex-1 px-4 pb-8 pt-32 sm:px-6 lg:pt-36">
          <div ref={mainShellRef} className="container flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            <aside className="hidden lg:block lg:w-72 lg:flex-shrink-0">
              <div
                style={{
                  position: "fixed",
                  top: "7rem",
                  left: Math.max(SIDEBAR_GUTTER, sidebarLeft),
                  width: `${SIDEBAR_WIDTH}px`,
                  maxHeight: "calc(100vh - 8rem)",
                  overflowY: "auto",
                  paddingRight: "0.75rem",
                }}
              >
                <div className="space-y-6">
                  <DashboardNav
                    guildId={selectedGuild}
                    isSuperAdmin={isSuperAdmin}
                    showProfile
                  />
                  <CommunitySidebar />
                </div>
              </div>
            </aside>
            <div className="flex-1 lg:min-h-[calc(100vh-10rem)]">{children}</div>
          </div>
        </main>
      </div>
    </DashboardGuildProvider>
  );
}
