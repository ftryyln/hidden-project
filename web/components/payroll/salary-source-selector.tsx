"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PayrollSource } from "@/lib/types";
import { Receipt, Shield, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS: Array<{
  value: PayrollSource;
  label: string;
  description: string;
  icon: typeof Receipt;
}> = [
  {
    value: "TRANSACTION",
    label: "From Transactions",
    description: "Use the confirmed income pool.",
    icon: Receipt,
  },
  {
    value: "LOOT",
    label: "From Loot",
    description: "Distribute the recorded loot value.",
    icon: Shield,
  },
];

interface SalarySourceSelectorProps {
  value: PayrollSource;
  onChange: (value: PayrollSource) => void;
  className?: string;
  disabled?: boolean;
}

export function SalarySourceSelector({
  value,
  onChange,
  className,
  disabled,
}: SalarySourceSelectorProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as PayrollSource)}
      className={cn("w-full", className)}
    >
      <TabsList className="grid w-full grid-cols-2 rounded-full border border-border/40 bg-muted/30 p-1 text-muted-foreground shadow-inner">
        {SOURCE_OPTIONS.map((option) => {
          const Icon = option.icon ?? Wallet;
          return (
            <TabsTrigger
              key={option.value}
              value={option.value}
              disabled={disabled}
              className="flex flex-col gap-1 rounded-full px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 data-[state=active]:border data-[state=active]:border-primary/50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:border-transparent"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" />
                {option.label}
              </div>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
