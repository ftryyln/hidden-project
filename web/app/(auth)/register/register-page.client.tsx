"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { RegisterForm } from "@/components/forms/register-form";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";

function RegisterFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <p className="text-sm text-muted-foreground">Loading registration form...</p>
    </main>
  );
}

function RegisterContent() {
  const { status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const inviteCode = searchParams?.get("invite");

  return (
    <AuthShell
      title="Create your account"
      description={
        <>
          Join Guild Manager and collaborate with your team.
          {inviteCode ? (
            <> Invite code detected, you&apos;ll be added to the guild automatically.</>
          ) : null}
        </>
      }
      topLink={{ href: "/login", label: "Already have an account?" }}
    >
      <RegisterForm />
      <p className="mt-6 text-center text-xs text-muted-foreground">
        By signing up, you agree to the community guidelines.
      </p>
    </AuthShell>
  );
}

export function RegisterPageClient() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterContent />
    </Suspense>
  );
}
