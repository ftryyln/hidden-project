"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonStar, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = React.ComponentProps<typeof Button>;

export function ThemeToggle({
  className,
  variant = "ghost",
  size = "icon",
  ...props
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && theme === "light";

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label="Toggle color theme"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={cn("shrink-0", className)}
      {...props}
    >
      {isLight ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  );
}
