"use client";

import { useMemo } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

interface CurrencyInputProps
  extends Omit<InputProps, "value" | "defaultValue" | "onChange"> {
  value?: number | null;
  onValueChange?: (value: number) => void;
}

export function CurrencyInput({ value, onValueChange, ...props }: CurrencyInputProps) {
  const displayValue = useMemo(() => {
    if (value === undefined || value === null || Number.isNaN(value)) return "";
    return value.toString();
  }, [value]);

  return (
    <div className="space-y-1">
      <Input
        inputMode="decimal"
        placeholder="0"
        {...props}
        value={displayValue}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next)) {
            onValueChange?.(next);
          } else if (event.target.value === "") {
            onValueChange?.(0);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {value ? formatCurrency(value) : "Enter the amount in Rupiah"}
      </p>
    </div>
  );
}
