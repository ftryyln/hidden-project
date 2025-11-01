"use client";

import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface KpiItem {
  title: string;
  icon: ReactNode;
  value: string | number;
}

interface KpiGridProps {
  items: KpiItem[];
  loading?: boolean;
}

export function KpiGrid({ items, loading }: KpiGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.title}
          className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 backdrop-blur"
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-3 text-sm uppercase tracking-wide">
              {item.icon}
              {item.title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-12 w-32 rounded-lg" />
            ) : (
              <span className="text-3xl font-bold">{item.value}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
