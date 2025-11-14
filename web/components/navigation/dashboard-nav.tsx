"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { UserMenu } from "@/components/navigation/user-menu";

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
      : "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors";
  const stateClasses =
    variant === "pill"
      ? link.isActive
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted/40"
      : link.isActive
        ? "border-primary/40 bg-primary/15 text-primary"
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

  if (links.length === 0) {
    return null;
  }

  return (
    <nav className={cn("w-full", className)}>
      <div className="flex flex-col gap-3">
        {showProfile && (
          <div className="rounded-2xl border border-border/50 bg-muted/5 p-2">
            <UserMenu appearance="sidebar" showDetails className="w-full" />
          </div>
        )}
        <div className="flex flex-col gap-1 rounded-2xl border border-border/50 bg-muted/5 p-2">
          {links.map((link) => (
            <LinkPill key={link.key} link={link} variant="sidebar" />
          ))}
        </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-left text-base font-semibold">Menu</DialogTitle>
          </DialogHeader>

          <div className="mt-4 grid gap-5">
            {mobileExtras && <div className="grid gap-4">{mobileExtras}</div>}
            <div className="grid gap-2">
              {links.map((link) => (
                <LinkPill
                  key={link.key}
                  link={link}
                  onNavigate={() => setMenuOpen(false)}
                  className="border border-border bg-background/70"
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DashboardNav;
