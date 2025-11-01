"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  topLink?: {
    href: string;
    label: string;
  };
  children: ReactNode;
}

export function AuthShell({ title, description, topLink, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="flex items-center justify-end gap-3 px-5 py-5 sm:px-8">
        <ThemeToggle />
        {topLink ? (
          <Link href={topLink.href} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
            {topLink.label}
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-10">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
