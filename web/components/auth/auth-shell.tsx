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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="absolute right-8 top-8 flex items-center gap-2">
        <ThemeToggle />
        {topLink ? (
          <Link href={topLink.href} className="text-sm text-muted-foreground hover:text-foreground">
            {topLink.label}
          </Link>
        ) : null}
      </div>
      <Card className="w-full max-w-md bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
