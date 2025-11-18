"use client";

import { useRef, type InputHTMLAttributes } from "react";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      {label && <Label>{label}</Label>}

      {/* tidak full width lagi, hanya selebar dua input */}
      <div className="flex items-center gap-2">
        <DateInput
          value={value.from ?? ""}
          placeholder="From date"
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
        />
        <span className="text-xs text-muted-foreground">–</span>
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
        // width dibatasi supaya nggak melar ke kanan
        className={`h-9 w-[150px] rounded-full border-border/60 px-3 text-right ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
