"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { useAuth } from "@/hooks/use-auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { SiDiscord } from "react-icons/si";

export default function LoginPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <AuthShell
      title="Guild Manager"
      description="Sign in as an officer or admin to manage your guild."
      topLink={{ href: "/register", label: "Create account" }}
    >
      <LoginForm />
      <div className="mt-4 text-center text-xs text-muted-foreground">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
      </div>
      <p className="mt-6 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <span>Created by Kyuto Fit</span>
        <Link
          href="https://discord.com/invite/5mrHnxx8wv"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-medium text-[#5865F2] transition-colors hover:text-[#4752C4]"
        >
          <SiDiscord className="h-4 w-4" />
          Join My Discord
        </Link>
      </p>
    </AuthShell>
  );
}
