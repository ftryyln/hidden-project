"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WemixAmount } from "@/components/wemix-amount";

interface TransactionSummaryCardsProps {
  income: number;
  expense: number;
}

export function TransactionSummaryCards({ income, expense }: TransactionSummaryCardsProps) {
  const net = income - expense;
  const cards = [
    { label: "Period income", value: income },
    { label: "Period expense", value: expense },
    { label: "Net", value: net },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-3xl font-bold">
              <WemixAmount
                value={card.value}
                className="text-3xl font-bold"
                iconSize={24}
                iconClassName="h-6 w-6"
              />
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </section>
  );
}
