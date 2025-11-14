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
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatLabel } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  className?: string;
  buttonProps?: ButtonProps;
  showDetails?: boolean;
  appearance?: "default" | "sidebar";
}

export function UserMenu({
  className,
  buttonProps,
  showDetails = false,
  appearance = "default",
}: UserMenuProps = {}) {
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

  const {
    variant = "ghost",
    size = "default",
    className: triggerClassName,
    ...triggerRest
  } = buttonProps ?? {};

  const baseTriggerClasses =
    appearance === "sidebar"
  size === "icon"
    ? "rounded-full"
    : "rounded-full px-3";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("shrink-0", baseTriggerClasses, className, triggerClassName)}
          {...triggerRest}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              appearance === "sidebar" && "w-full",
            )}
          >
            <Avatar className={cn("bg-muted/40", appearance === "sidebar" ? "h-11 w-11" : "h-9 w-9")}>
              <AvatarFallback>{initials || "GM"}</AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "text-left",
                showDetails ? "block" : "hidden sm:block",
                appearance === "sidebar" && "leading-tight",
              )}
            >
              <p className="text-sm font-semibold">{user?.display_name ?? "Officer"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              {appearance === "sidebar" && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {formatLabel(user?.app_role) || "Member"}
                </p>
              )}
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
          Role: {formatLabel(user?.app_role) || "Member"}
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
