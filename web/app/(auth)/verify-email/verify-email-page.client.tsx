"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ResendVerificationForm } from "@/components/forms/resend-verification-form";
import { AuthShell } from "@/components/auth/auth-shell";

export function VerifyEmailPageClient() {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") ?? "";

  return (
    <AuthShell
      title="Verify your email"
      description="Check your inbox for a verification email. You need to confirm your address before you can sign in."
      topLink={{ href: "/login", label: "Back to login" }}
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {email
            ? `We sent a verification link to ${email}. It may take a minute to arrive.`
            : "We sent a verification link to your email address. It may take a minute to arrive."}
        </p>
        <div className="rounded-lg border border-border/40 bg-card/40 p-4">
          <h2 className="text-sm font-semibold">Didn&apos;t receive the email?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Resend the verification link below. Make sure to check your spam folder.
          </p>
          <div className="mt-4">
            <ResendVerificationForm defaultEmail={email} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Already verified your address?{" "}
          <Link href="/login" className="font-medium text-primary underline">
            Sign in now
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
