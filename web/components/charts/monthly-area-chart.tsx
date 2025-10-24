"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlySummaryPoint } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

interface MonthlyAreaChartProps {
  data: MonthlySummaryPoint[];
}

export function MonthlyAreaChart({ data }: MonthlyAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
        <XAxis
          dataKey="month"
          stroke="rgba(148, 163, 184, 0.7)"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="rgba(148, 163, 184, 0.7)"
          tickFormatter={(value) => (value >= 1_000_000 ? `${value / 1_000_000}jt` : `${value}`)}
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(15,23,42,0.9)",
            borderRadius: "1rem",
            border: "1px solid rgba(148,163,184,0.2)",
          }}
          formatter={(value: number, key) => [
            formatCurrency(value),
            key === "income" ? "Income" : "Expense",
          ]}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#34d399"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#incomeGradient)"
          name="Income"
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="#f97316"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#expenseGradient)"
          name="Expense"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
