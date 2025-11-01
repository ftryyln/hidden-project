"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGuilds } from "@/hooks/queries/use-guilds";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuildSwitcherProps {
  value: string | null;
  onChange: (guildId: string) => void;
  className?: string;
}

export function GuildSwitcher({ value, onChange, className }: GuildSwitcherProps) {
  const { data, isLoading } = useGuilds();
  const guilds = data ?? [];

  const label = useMemo(() => {
    const selected = guilds.find((guild) => guild.id === value);
    if (!selected) return "Select guild";
    return selected.name;
  }, [value, guilds]);

  if (isLoading) {
    return (
      <div className={cn("flex h-10 w-full items-center justify-center rounded-full border border-border/60 bg-muted/20", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-11 rounded-full bg-muted/20 text-sm px-4",
          "w-auto min-w-[160px] sm:min-w-[220px]",
          className,
        )}
      >
        <SelectValue placeholder="Select guild">{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {guilds.map((guild) => (
          <SelectItem key={guild.id} value={guild.id}>
            {guild.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
