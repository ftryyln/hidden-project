"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RegisterForm } from "@/components/forms/register-form";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function RegisterPage() {
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="absolute right-8 top-8 flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Already have an account?
        </Link>
      </div>
      <Card className="w-full max-w-md bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Create your account
          </CardTitle>
          <CardDescription>
            Join Guild Manager and collaborate with your team.
            {inviteCode ? (
              <>
                {" "}
                Invite code detected, you&apos;ll be added to the guild
                automatically.
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <p className="mt-6 text-center text-xs text-muted-foreground">
            By signing up, you agree to the community guidelines.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
