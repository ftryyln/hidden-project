"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

type ResetCredentials = {
  code?: string;
  access_token?: string;
  refresh_token?: string | null;
};

export default function ResetPasswordPage() {
  const { status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [credentials, setCredentials] = useState<ResetCredentials>({});

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    const nextCredentials: ResetCredentials = {};

    const queryCode = searchParams?.get("code") ?? undefined;
    const queryAccess = searchParams?.get("access_token") ?? searchParams?.get("token") ?? undefined;
    const queryRefresh = searchParams?.get("refresh_token") ?? undefined;
    const queryType = searchParams?.get("type") ?? undefined;

    if (queryCode) {
      nextCredentials.code = queryCode;
    } else if (queryAccess && (!queryType || queryType === "recovery")) {
      nextCredentials.access_token = queryAccess;
      nextCredentials.refresh_token = queryRefresh ?? null;
    }

    if (!nextCredentials.code && !nextCredentials.access_token && typeof window !== "undefined") {
      const rawHash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      if (rawHash) {
        const hashParams = new URLSearchParams(rawHash);
        const hashCode = hashParams.get("code");
        const hashAccess = hashParams.get("access_token") ?? hashParams.get("token");
        const hashRefresh = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");
        if (hashCode) {
          nextCredentials.code = hashCode;
        } else if (hashAccess && (!hashType || hashType === "recovery")) {
          nextCredentials.access_token = hashAccess;
          nextCredentials.refresh_token = hashRefresh;
        }
      }
    }

    setCredentials(nextCredentials);
  }, [searchParams]);

  const hasCredentials = Boolean(credentials.code || credentials.access_token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="absolute right-8 top-8 flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to login
        </Link>
      </div>
      <Card className="w-full max-w-md bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Choose a new password
          </CardTitle>
          <CardDescription>
            Enter your new password below. Once updated you will be redirected
            to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasCredentials ? (
            <ResetPasswordForm credentials={credentials} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or expired. Request a new one from the{" "}
              <Link href="/forgot-password" className="underline">
                forgot password page
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
