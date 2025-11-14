"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { WemixAmount } from "@/components/wemix-amount";
import type { Member, PayrollMode, PayrollSource } from "@/lib/types";
import type { PayrollBatchCreationPayload } from "@/lib/api/payroll";
import { cn } from "@/lib/utils";

const MODE_OPTIONS: Array<{ value: PayrollMode; label: string; description: string }> = [
  { value: "EQUAL", label: "Split Evenly", description: "Every member receives the same amount." },
  {
    value: "PERCENTAGE",
    label: "Percentage",
    description: "Provide the percentage for each member (must total 100%).",
  },
  {
    value: "FIXED",
    label: "Fixed Amount",
    description: "Enter a custom nominal for each member (must sum to the total).",
  },
];

interface SalaryFormProps {
  source: PayrollSource;
  availableBalance: number;
  members: Member[];
  onSubmit: (payload: PayrollBatchCreationPayload) => Promise<unknown>;
  isSubmitting?: boolean;
}

function formatSource(source: PayrollSource): string {
  return source === "TRANSACTION" ? "Transactions" : "Loot";
}

export function SalaryForm({
  source,
  availableBalance,
  members,
  onSubmit,
  isSubmitting,
}: SalaryFormProps) {
  const [mode, setMode] = useState<PayrollMode>("EQUAL");
  const [totalAmount, setTotalAmount] = useState(0);
  const [periodFrom, setPeriodFrom] = useState<string>("");
  const [periodTo, setPeriodTo] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [fixedAmounts, setFixedAmounts] = useState<Record<string, number>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>({});

  const membersById = useMemo(() => {
    return new Map(members.map((member) => [member.id, member]));
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) {
      return members;
    }
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => member.in_game_name.toLowerCase().includes(query));
  }, [memberSearch, members]);

  const equalAllocations = useMemo(() => {
    if (mode !== "EQUAL" || selectedMembers.length === 0 || totalAmount <= 0) {
      return new Map<string, number>();
    }
    const totalCents = Math.round(totalAmount * 100);
    const baseShare = Math.floor(totalCents / selectedMembers.length);
    const remainder = totalCents - baseShare * selectedMembers.length;
    const allocations = new Map<string, number>();
    selectedMembers.forEach((memberId, index) => {
      const cents = index === selectedMembers.length - 1 ? baseShare + remainder : baseShare;
      allocations.set(memberId, cents / 100);
    });
    return allocations;
  }, [mode, selectedMembers, totalAmount]);

  const percentageTotal = useMemo(
    () => selectedMembers.reduce((acc, memberId) => acc + (percentages[memberId] ?? 0), 0),
    [selectedMembers, percentages],
  );
  const fixedTotal = useMemo(
    () => selectedMembers.reduce((acc, memberId) => acc + (fixedAmounts[memberId] ?? 0), 0),
    [selectedMembers, fixedAmounts],
  );

  const nearLimit = availableBalance > 0 && totalAmount >= availableBalance * 0.8;
  const exceedsBalance = totalAmount > availableBalance;
  const percentageValid = mode !== "PERCENTAGE" || Math.abs(percentageTotal - 100) < 0.01;
  const fixedValid = mode !== "FIXED" || Math.abs(fixedTotal - totalAmount) < 0.01;
  const hasMembers = selectedMembers.length > 0;
  const amountValid = totalAmount > 0 && !Number.isNaN(totalAmount);

  const canSubmit =
    hasMembers && amountValid && !exceedsBalance && percentageValid && fixedValid && !isSubmitting;

  const handleToggleMember = useCallback(
    (memberId: string, checked: boolean) => {
      setSelectedMembers((prev) => {
        if (checked) {
          if (prev.includes(memberId)) {
            return prev;
          }
          return [...prev, memberId];
        }
        return prev.filter((id) => id !== memberId);
      });
      if (!checked) {
        setFixedAmounts((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
        setPercentages((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
      }
    },
    [],
  );

  const allocationPreview = useMemo(() => {
    return selectedMembers.map((memberId) => {
      const member = membersById.get(memberId);
      let amount = 0;
      let percentage: number | undefined;
      if (mode === "EQUAL") {
        amount = equalAllocations.get(memberId) ?? 0;
      } else if (mode === "PERCENTAGE") {
        percentage = percentages[memberId] ?? 0;
        amount = totalAmount > 0 ? (totalAmount * percentage) / 100 : 0;
      } else if (mode === "FIXED") {
        amount = fixedAmounts[memberId] ?? 0;
      }
      return {
        member,
        amount,
        percentage,
      };
    });
  }, [
    selectedMembers,
    membersById,
    mode,
    equalAllocations,
    percentages,
    totalAmount,
    fixedAmounts,
  ]);

  const resetMemberInputs = useCallback((nextMode: PayrollMode) => {
    if (nextMode === "EQUAL") {
      setFixedAmounts({});
      setPercentages({});
    }
  }, []);

  const handleModeChange = useCallback(
    (nextMode: PayrollMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
      resetMemberInputs(nextMode);
    },
    [mode, resetMemberInputs],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload: PayrollBatchCreationPayload = {
      source,
      mode,
      totalAmount,
      periodFrom: periodFrom || null,
      periodTo: periodTo || null,
      notes: notes || null,
      members: selectedMembers.map((memberId) => {
        if (mode === "PERCENTAGE") {
          return { memberId, percentage: percentages[memberId] ?? 0 };
        }
        if (mode === "FIXED") {
          return { memberId, amount: fixedAmounts[memberId] ?? 0 };
        }
        return { memberId, amount: equalAllocations.get(memberId) ?? 0 };
      }),
    };
    await onSubmit(payload);
    setSelectedMembers([]);
    setTotalAmount(0);
    setNotes("");
    setPeriodFrom("");
    setPeriodTo("");
    setFixedAmounts({});
    setPercentages({});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribute Member Salary</CardTitle>
        <CardDescription>
          Choose the {formatSource(source)} balance and set the total amount to disburse.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Funding Source</Label>
              <Input value={formatSource(source)} disabled />
            </div>
            <div className="space-y-2">
              <Label>Distribution Mode</Label>
              <div className="grid gap-2 md:grid-cols-3">
                {MODE_OPTIONS.map((option) => {
                  const active = mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleModeChange(option.value)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-2xl border border-border/40 bg-background/40 px-4 py-3 text-left text-muted-foreground transition hover:border-primary/60 hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        active && "border-primary text-foreground shadow-lg bg-primary/5",
                      )}
                    >
                      <p className="font-semibold leading-tight">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Total Salary (Wemix)</Label>
              <Input
                inputMode="decimal"
                type="number"
                min={0}
                step="100"
                placeholder="0"
                value={Number.isNaN(totalAmount) ? "" : totalAmount}
                onChange={(event) => setTotalAmount(Number(event.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                <WemixAmount value={totalAmount || 0} iconSize={12} />
              </p>
            </div>
            <div className="space-y-2">
              <Label>Period (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={periodFrom}
                  onChange={(event) => setPeriodFrom(event.target.value)}
                />
                <Input
                  type="date"
                  value={periodTo}
                  onChange={(event) => setPeriodTo(event.target.value)}
                  min={periodFrom || undefined}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <Label>Select Members</Label>
                <p className="text-xs text-muted-foreground">
                  Pick at least one active member. Use search to narrow the list.
                </p>
              </div>
              <Input
                placeholder="Search member"
                className="md:max-w-xs"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
              />
            </div>
            <div className="rounded-2xl border border-border/40 bg-muted/5">
              <ScrollArea className="max-h-64">
                <div className="divide-y">
                  {filteredMembers.length === 0 && (
                    <p className="p-4 text-sm text-muted-foreground">No members found.</p>
                  )}
                  {filteredMembers.map((member) => {
                    const checked = selectedMembers.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition hover:bg-muted/50",
                          checked && "bg-muted/30",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => handleToggleMember(member.id, Boolean(next))}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{member.in_game_name}</p>
                            {checked && (
                              <Badge variant="outline" className="text-[11px] uppercase">
                                {mode === "EQUAL"
                                  ? "Even"
                                  : mode === "PERCENTAGE"
                                    ? "Percentage"
                                    : "Fixed"}
                              </Badge>
                            )}
                          </div>
                          {checked && mode === "PERCENTAGE" && (
                            <div className="grid gap-1">
                              <Label className="text-xs text-muted-foreground">Percentage</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={100}
                                step="0.01"
                                value={percentages[member.id] ?? ""}
                                onChange={(event) =>
                                  setPercentages((prev) => ({
                                    ...prev,
                                    [member.id]: Number(event.target.value) || 0,
                                  }))
                                }
                                placeholder="0"
                              />
                            </div>
                          )}
                          {checked && mode === "FIXED" && (
                            <div className="grid gap-1">
                              <Label className="text-xs text-muted-foreground">Amount</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="1000"
                                value={fixedAmounts[member.id] ?? ""}
                                onChange={(event) =>
                                  setFixedAmounts((prev) => ({
                                    ...prev,
                                    [member.id]: Number(event.target.value) || 0,
                                  }))
                                }
                                placeholder="0"
                              />
                              <p className="text-xs text-muted-foreground">
                                <WemixAmount value={fixedAmounts[member.id] ?? 0} iconSize={12} />
                              </p>
                            </div>
                          )}
                          {checked && mode === "EQUAL" && (
                            <p className="text-xs text-muted-foreground">
                              Estimation:{" "}
                              <WemixAmount value={equalAllocations.get(member.id) ?? 0} iconSize={12} />
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional. Example: Week 2 payroll."
              rows={3}
            />
          </div>

            <div className="space-y-2 rounded-2xl border border-dashed border-border/40 bg-muted/5 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">Allocation Summary</span>
              <Badge variant="outline" className="rounded-full">
                {selectedMembers.length} Member{selectedMembers.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <p>
                Total salary:
                {" "}
                <WemixAmount value={totalAmount || 0} iconSize={14} />
              </p>
              <p>
                Available balance:
                {" "}
                <WemixAmount value={availableBalance} iconSize={14} />
              </p>
              {mode === "PERCENTAGE" && (
                <p>
                  Total percentage:{" "}
                  <span className={percentageValid ? "" : "text-destructive"}>
                    {percentageTotal.toFixed(2)}%
                  </span>{" "}
                  (must equal 100%)
                </p>
              )}
              {mode === "FIXED" && (
                <p>
                  Total member amount:{" "}
                  <span className={fixedValid ? "" : "text-destructive"}>
                    <WemixAmount value={fixedTotal || 0} iconSize={14} />
                  </span>{" "}
                </p>
              )}
              {nearLimit && (
                <p className="text-amber-600">
                  Warning: total salary is over 80% of the available balance.
                </p>
              )}
              {exceedsBalance && (
                <p className="text-destructive">Total salary exceeds the available balance.</p>
              )}
            </div>
            <div className="mt-3 rounded-xl border border-border/30 bg-muted/10">
              {allocationPreview.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No members selected yet.</p>
              ) : (
                <ul className="divide-y text-xs">
                  {allocationPreview.map((allocation, index) => (
                    <li
                      key={allocation.member?.id ?? `${index}-${allocation.amount}`}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span>{allocation.member?.in_game_name ?? "-"}</span>
                      <span className="font-medium">
                        <WemixAmount value={allocation.amount || 0} />
                        {mode === "PERCENTAGE" && (
                          <span className="ml-2 text-muted-foreground">
                            ({(allocation.percentage ?? 0).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Processing..." : "Distribute Salary"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => {
                setSelectedMembers([]);
                setTotalAmount(0);
                setNotes("");
                setPeriodFrom("");
                setPeriodTo("");
                setFixedAmounts({});
                setPercentages({});
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
