"use client";

import { useRef, type InputHTMLAttributes } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: string;
  to?: string;
}

interface DateRangePickerProps {
  label?: string;
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ label, value, onChange, className }: DateRangePickerProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <Label>{label}</Label>}

      <div className="flex w-full items-center gap-2">
        <DateInput
          value={value.from ?? ""}
          placeholder="From date"
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
        />
        <span className="px-1 text-xs text-muted-foreground whitespace-nowrap">-</span>
        <DateInput
          value={value.to ?? ""}
          placeholder="To date"
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
        />
      </div>
    </div>
  );
}

interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
}

function DateInput({ value, onChange, placeholder, className, ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (inputRef.current) {
      inputRef.current.showPicker?.();
      inputRef.current.focus();
    }
  };

  return (
    <div className="relative">
      <Input
        type="date"
        ref={inputRef}
        value={value}
        onFocus={openPicker}
        onChange={onChange}
        aria-label={placeholder}
        className={cn(
          "h-9 flex-1 basis-0 min-w-0 rounded-full border-border/60 px-3 text-sm text-left sm:max-w-[150px]",
          className,
        )}
        {...props}
      />
    </div>
  );
}
