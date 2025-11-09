"use client";

import { useMemo } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { WemixAmount } from "@/components/wemix-amount";

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
        {value ? (
          <WemixAmount
            value={value}
            className="text-xs text-muted-foreground"
            iconClassName="h-3 w-3"
            iconSize={12}
          />
        ) : (
          "Enter the amount in Wemix"
        )}
      </p>
    </div>
  );
}
