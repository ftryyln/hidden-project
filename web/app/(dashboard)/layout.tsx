"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { GuildSwitcher } from "@/components/guild/guild-switcher";
import { DashboardNav } from "@/components/navigation/dashboard-nav";
import { UserMenu } from "@/components/navigation/user-menu";
import { Button } from "@/components/ui/button";
import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const STORAGE_KEY = "guild-manager:selected-guild";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);

  const guildFromPath = useMemo(() => {
    const match = pathname?.match(/\/guilds\/([^/]+)/);
    if (match && match[1] !== "select") {
      return match[1];
    }
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return stored;
  }, [pathname]);

  useEffect(() => {
    if (guildFromPath && guildFromPath !== selectedGuild) {
      setSelectedGuild(guildFromPath);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, guildFromPath);
      }
    }
  }, [guildFromPath, selectedGuild]);

  const handleGuildChange = (guildId: string) => {
    setSelectedGuild(guildId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, guildId);
    }
    if (pathname?.startsWith("/guilds/")) {
      const remainder = pathname.replace(/\/guilds\/[^/]+/, "");
      router.push(`/guilds/${guildId}${remainder}`);
    } else {
      router.push("/dashboard");
    }
  };

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

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex flex-col gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold tracking-tight">Guild Manager</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <MoonStar className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <GuildSwitcher value={selectedGuild} onChange={handleGuildChange} />
              <UserMenu />
            </div>
          </div>
          <DashboardNav guildId={selectedGuild} />
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
