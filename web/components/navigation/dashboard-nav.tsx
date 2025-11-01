"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LayoutGrid, Users, Receipt, Gem, BarChart3, ShieldCheck, UserCog, Menu, X } from "lucide-react";

interface DashboardNavProps {
  guildId: string | null;
  isSuperAdmin?: boolean;
  className?: string;
  mobileExtras?: ReactNode;
}

const baseLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/guilds/[gid]/members", label: "Members", icon: Users },
  { href: "/guilds/[gid]/transactions", label: "Transactions", icon: Receipt },
  { href: "/guilds/[gid]/loot", label: "Loot", icon: Gem },
  { href: "/guilds/[gid]/reports", label: "Reports", icon: BarChart3 },
];

const adminLinks = [
  { href: "/admin", label: "Admin Guilds", icon: ShieldCheck },
  { href: "/admin/users", label: "Admin Users", icon: UserCog },
];

export function DashboardNav({
  guildId,
  isSuperAdmin = false,
  className,
  mobileExtras,
}: DashboardNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = useMemo(
    () => (isSuperAdmin ? [...baseLinks, ...adminLinks] : baseLinks),
    [isSuperAdmin],
  );

  const renderLink = (href: string, label: string, Icon: typeof LayoutGrid, className?: string) => {
    const target = href.includes("[gid]")
      ? guildId
        ? href.replace("[gid]", guildId)
        : href.replace("[gid]", "select")
      : href;
    const isActive =
      pathname === target || (href.includes("[gid]") && guildId && pathname.startsWith(target));

    return (
      <Link
        key={href}
        href={target}
        onClick={() => setMenuOpen(false)}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-muted/40",
          isActive ? "bg-muted/50 text-foreground" : "text-muted-foreground",
          !guildId && href.includes("[gid]") && "pointer-events-none opacity-60",
          className,
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
        {href.includes("[gid]") && !guildId && (
          <Badge variant="outline" className="ml-1 text-[10px] uppercase">
            select guild
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <nav className="hidden items-center gap-2 md:flex">
        {links.map(({ href, label, icon }) => renderLink(href, label, icon))}
      </nav>

      <div className="md:hidden">
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full border border-border bg-background/60"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation menu</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader className="flex flex-row items-center justify-between space-y-0">
              <DialogTitle className="text-left text-base font-semibold">Menu</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close navigation menu</span>
              </Button>
            </DialogHeader>
            <div className="mt-4 grid gap-5">
              {mobileExtras}
              <div className="grid gap-2">
                {links.map(({ href, label, icon }) =>
                  renderLink(href, label, icon, "border border-border/60 bg-muted/30"),
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
