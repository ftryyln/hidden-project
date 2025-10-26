"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";

type ResetCredentials = {
  code?: string;
  access_token?: string;
  refresh_token?: string | null;
};

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <p className="text-sm text-muted-foreground">Loading reset form...</p>
    </main>
  );
}

function ResetPasswordContent() {
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
    <AuthShell
      title="Choose a new password"
      description="Enter your new password below. Once updated you will be redirected to the dashboard."
      topLink={{ href: "/login", label: "Back to login" }}
    >
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
    </AuthShell>
  );
}

export function ResetPasswordPageClient() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
