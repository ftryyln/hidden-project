"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutGrid,
  Users,
  Receipt,
  Gem,
  BarChart3,
  ShieldCheck,
  UserCog,
  Menu,
  Wallet,
  CalendarCheck,
  UserRound,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import { formatLabel } from "@/lib/format";

interface DashboardNavProps {
  guildId: string | null;
  isSuperAdmin?: boolean;
  className?: string;
  showProfile?: boolean;
}

interface DashboardMobileNavProps extends DashboardNavProps {
  triggerClassName?: string;
  mobileExtras?: ReactNode;
}

const baseLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/guilds/[gid]/members", label: "Members", icon: Users },
  { href: "/guilds/[gid]/transactions", label: "Transactions", icon: Receipt },
  { href: "/guilds/[gid]/loot", label: "Loot", icon: Gem },
  { href: "/guilds/[gid]/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/guilds/[gid]/salary", label: "Payroll", icon: Wallet },
  { href: "/guilds/[gid]/reports", label: "Reports", icon: BarChart3 },
];

const adminLinks = [
  { href: "/admin", label: "Guild Management", icon: ShieldCheck },
  { href: "/admin/users", label: "User Management", icon: UserCog },
];

type ComputedLink = {
  key: string;
  label: string;
  icon: typeof LayoutGrid;
  target: string;
  isActive: boolean;
  disabled: boolean;
};

function useNavLinks(guildId: string | null, isSuperAdmin: boolean) {
  const pathname = usePathname();

  return useMemo<ComputedLink[]>(() => {
    const linkDefs = isSuperAdmin ? [...baseLinks, ...adminLinks] : baseLinks;
    return linkDefs.map((link) => {
      const requiresGuild = link.href.includes("[gid]");
      const target = requiresGuild
        ? guildId
          ? link.href.replace("[gid]", guildId)
          : link.href.replace("[gid]", "select")
        : link.href;
      const isActive = Boolean(
        pathname === target || (requiresGuild && guildId && pathname.startsWith(target)),
      );
      const disabled = requiresGuild && !guildId;
      return {
        key: link.href,
        label: link.label,
        icon: link.icon,
        target,
        isActive,
        disabled,
      };
    });
  }, [guildId, isSuperAdmin, pathname]);
}

type LinkVariant = "pill" | "sidebar";

function LinkPill({
  link,
  onNavigate,
  className,
  variant = "pill",
}: {
  link: ComputedLink;
  onNavigate?: () => void;
  className?: string;
  variant?: LinkVariant;
}) {
  const Icon = link.icon;
  const baseClasses =
    variant === "pill"
      ? "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition"
      : "flex w-full items-center justify-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors";
  const stateClasses =
    variant === "pill"
      ? link.isActive
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted/40"
      : link.isActive
        ? "border-primary bg-primary/10 text-primary shadow-sm"
        : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40";
  return (
    <Link
      key={link.key}
      href={link.target}
      onClick={onNavigate}
      aria-current={link.isActive ? "page" : undefined}
      aria-disabled={link.disabled}
      className={cn(baseClasses, stateClasses, link.disabled && "pointer-events-none opacity-60", className)}
    >
      <Icon className="h-4 w-4" />
      {link.label}
      {link.disabled && (
        <Badge variant="outline" className="ml-1 text-[10px] uppercase">
          select guild
        </Badge>
      )}
    </Link>
  );
}

export function DashboardNav({
  guildId,
  isSuperAdmin = false,
  className,
  showProfile = false,
}: DashboardNavProps) {
  const links = useNavLinks(guildId, isSuperAdmin);
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const initials = user?.display_name
    ?.split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Signed out",
      description: "See you next time!",
    });
  };

  const handleProfileNavigate = () => {
    router.push("/profile");
  };

  if (links.length === 0) {
    return null;
  }

  return (
    <nav className={cn("w-full", className)}>
      <div className="flex flex-col gap-3">
        {showProfile && (
          <div className="rounded-2xl border border-border/50 bg-muted/5 p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-11 w-11 bg-muted/40">
                <AvatarFallback>{initials || "GM"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1 leading-tight">
                <p className="text-sm font-semibold">{user?.display_name ?? "Officer"}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {formatLabel(user?.app_role) || "Member"}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-muted/5 p-2">
          {links.map((link) => (
            <LinkPill key={link.key} link={link} variant="sidebar" />
          ))}
        </div>
        {showProfile && (
          <div className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-muted/5 p-2">
            <button
              onClick={handleProfileNavigate}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border/60 hover:bg-muted/40"
            >
              <UserRound className="h-4 w-4" />
              Profile Settings
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-destructive transition-colors hover:border-border/60 hover:bg-muted/40"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export function DashboardMobileNav({
  guildId,
  isSuperAdmin = false,
  triggerClassName,
  mobileExtras,
}: DashboardMobileNavProps) {
  const links = useNavLinks(guildId, isSuperAdmin);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const initials = user?.display_name
    ?.split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Signed out",
      description: "See you next time!",
    });
    setMenuOpen(false);
  };

  const handleProfileNavigate = () => {
    router.push("/profile");
    setMenuOpen(false);
  };

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "rounded-2xl border-border/60 bg-muted/20 text-foreground",
              triggerClassName,
            )}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-sm">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-left text-base font-semibold">Menu</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid gap-6 py-4">
              {mobileExtras && <div className="grid gap-4">{mobileExtras}</div>}

              {/* User Info */}
              <div className="rounded-2xl border border-border/50 bg-muted/5 p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-11 w-11 bg-muted/40">
                    <AvatarFallback>{initials || "GM"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1 leading-tight">
                    <p className="text-sm font-semibold">{user?.display_name ?? "Officer"}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      {formatLabel(user?.app_role) || "Member"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="grid gap-2">
                {links.map((link) => (
                  <LinkPill
                    key={link.key}
                    link={link}
                    onNavigate={() => setMenuOpen(false)}
                    className=""
                  />
                ))}
              </div>

              {/* Profile Settings & Logout */}
              <div className="grid gap-2">
                <button
                  onClick={handleProfileNavigate}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40"
                >
                  <UserRound className="h-4 w-4" />
                  Profile Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-muted/40"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardNav;
