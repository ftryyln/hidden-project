"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

const DISCORD_INVITE =
  env.public.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/DbP82JmpyG";

export function NoGuildAccessCard() {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <Card className="w-full max-w-3xl rounded-3xl border border-border/60 bg-muted/10 p-8 text-center shadow-lg">
        <CardContent className="space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-foreground">No Guild Access Yet</p>
            <p className="text-sm text-muted-foreground">
              Your account has been registered, but you haven’t been assigned any role yet.
              Please contact a guild admin or officer to request access so you can start
              using the dashboard.
            </p>
          </div>
          <div className="pt-2">
            <Button
              size="lg"
              className="rounded-full px-6"
              asChild
            >
              <Link href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <SiDiscord className="h-4 w-4" />
                Contact Admin via Discord
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Please provide your account email so the admin can assign the correct role.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
