"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { LogOut, Shield } from "lucide-react";

export function UserMenu() {
  const { user, logout } = useAuth();
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="rounded-full px-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border/40">
              <AvatarFallback>{initials || "GM"}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight">{user?.display_name ?? "Officer"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Signed in</DropdownMenuLabel>
        <div className="px-2 py-2 text-sm">
          <p className="font-semibold">{user?.display_name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          Role: {user?.app_role ?? "member"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs text-muted-foreground">
          {formatDateTime(new Date())}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} className="gap-2 text-destructive">
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
