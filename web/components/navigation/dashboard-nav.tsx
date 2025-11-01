"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Users, Receipt, Gem, BarChart3, ShieldCheck, UserCog } from "lucide-react";

interface DashboardNavProps {
  guildId: string | null;
  isSuperAdmin?: boolean;
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

export function DashboardNav({ guildId, isSuperAdmin = false }: DashboardNavProps) {
  const pathname = usePathname();
  const links = isSuperAdmin ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <nav className="flex items-center gap-2">
      {links.map(({ href, label, icon: Icon }) => {
        const target = href.includes("[gid]")
          ? guildId
            ? href.replace("[gid]", guildId)
            : href.replace("[gid]", "select")
          : href;
        const isActive =
          pathname === target ||
          (href.includes("[gid]") && guildId && pathname.startsWith(target));

        return (
          <Link
            key={href}
            href={target}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition hover:bg-muted/40",
              isActive ? "bg-muted/50 text-foreground" : "text-muted-foreground",
              !guildId && href.includes("[gid]") && "pointer-events-none opacity-60",
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
      })}
    </nav>
  );
}
