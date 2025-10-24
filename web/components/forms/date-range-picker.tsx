"use client";

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
}

export function DateRangePicker({ label, value, onChange }: DateRangePickerProps) {
  return (
    <div className="grid gap-2">
      {label && <Label>{label}</Label>}
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          value={value.from ?? ""}
          onChange={(event) => onChange({ ...value, from: event.target.value || undefined })}
        />
        <Input
          type="date"
          value={value.to ?? ""}
          onChange={(event) => onChange({ ...value, to: event.target.value || undefined })}
        />
      </div>
    </div>
  );
}
