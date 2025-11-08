import { type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  onSelect?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  separatorBefore?: boolean;
}

export interface ActionMenuProps {
  ariaLabel: string;
  items: ActionMenuItem[];
  trigger?: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}

export function ActionMenu({
  ariaLabel,
  items,
  trigger,
  align = "end",
  className,
}: ActionMenuProps) {
  const defaultTrigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={ariaLabel}
      className={cn("rounded-full", className)}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger ?? defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="min-w-[180px] rounded-2xl border border-border/40 bg-card/95 text-sm shadow-xl backdrop-blur"
      >
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`}>
            {item.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={item.disabled}
              onSelect={(event) => {
                event.preventDefault();
                if (!item.disabled) {
                  item.onSelect?.();
                }
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                item.destructive && "text-destructive focus:bg-destructive/10",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
