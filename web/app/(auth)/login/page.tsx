"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/forms/login-form";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <div className="absolute right-8 top-8 flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/register"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Create account
        </Link>
      </div>
      <Card className="w-full max-w-md bg-card/90 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Guild Manager</CardTitle>
          <CardDescription>
            Sign in as an officer or admin to manage your guild.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/forgot-password" className="underline">
              Forgot your password?
            </Link>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
            <span>Created by Kyuto Fit</span>
            <Link
              href="https://discord.com/invite/5mrHnxx8wv"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-[#5865F2] hover:text-[#4752C4] transition-colors"
            >
              <SiDiscord className="w-4 h-4" />
              Join My Discord
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
