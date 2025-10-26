"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";

export function ForgotPasswordPageClient() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email address and we'll send you a password reset link."
      topLink={{ href: "/login", label: "Back to login" }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
