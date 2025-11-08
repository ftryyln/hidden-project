"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface WemixAmountProps {
  value: number | string;
  className?: string;
  iconClassName?: string;
  iconSize?: number;
  srLabel?: string;
}

export function WemixAmount({
  value,
  className,
  iconClassName,
  iconSize = 16,
  srLabel = "WEMIX coin",
}: WemixAmountProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      <Image
        src="/assets/coin-icons/wemix.svg"
        alt={srLabel}
        width={iconSize}
        height={iconSize}
        className={cn("h-4 w-4", iconClassName)}
        priority={false}
      />
      <span>{formatCurrency(value)}</span>
    </span>
  );
}
