"use client";

import Link from "next/link";
import { MessageSquare, Youtube, Loader2 } from "lucide-react";

import { SectionCard } from "@/components/responsive/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import dynamic from "next/dynamic";

const DISCORD_INVITE =
  env.public.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/DbP82JmpyG";
const YOUTUBE_CHANNEL =
  env.public.NEXT_PUBLIC_YOUTUBE_CHANNEL_URL ?? "https://www.youtube.com/@kyutofit";

const DONATION_URL = "https://sss.wemixplay.com/en/lygl/board/10788";

const VideoPlayer = dynamic(() => import("./youtube-player"), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center rounded-2xl border border-border/60 bg-muted/10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

const latestVideoConfig = {
  url: env.public.NEXT_PUBLIC_YOUTUBE_LATEST_VIDEO_URL,
  title:
    env.public.NEXT_PUBLIC_YOUTUBE_LATEST_VIDEO_TITLE ??
    "Optimizing multi-guild payroll cycles",
  duration: env.public.NEXT_PUBLIC_YOUTUBE_LATEST_VIDEO_DURATION ?? "Watch now",
  views: env.public.NEXT_PUBLIC_YOUTUBE_LATEST_VIDEO_VIEWS ?? "1.2k views",
};

export function CommunitySidebar() {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Join the Discord"
        description="Sync announcements, coordinate raids, and get help from fellow members."
        icon={<MessageSquare className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["KM", "DR", "QY"].map((label) => (
                <div
                  key={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-background bg-muted/60 text-xs font-semibold text-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
            <Badge variant="outline" className="rounded-full border-border/50 bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              open community
            </Badge>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Share raid strategies & payout tips</li>
            <li>Live Q&A with fellow officers</li>
            <li>Release announcements & patch notes first</li>
          </ul>
          <Button asChild className="w-full rounded-full">
            <Link href={DISCORD_INVITE} target="_blank" rel="noreferrer">
              Join Discord
            </Link>
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Creator spotlight"
        description="Kyuto breaks down raid clears, meta builds, and the latest updates."
        icon={<Youtube className="h-5 w-5" />}
      >
        <div className="space-y-4">
          {latestVideoConfig.url ? (
            <VideoPlayer videoUrl={latestVideoConfig.url} title={latestVideoConfig.title} />
          ) : (
            <Link
              href={YOUTUBE_CHANNEL}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-2xl border border-border/60 bg-muted/20"
            >
              <div className="relative h-40 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-transparent">
                <div className="absolute inset-0 flex flex-col justify-between p-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-primary">See what's new</p>
                    <p className="text-lg font-semibold leading-tight text-foreground line-clamp-2">
                      {latestVideoConfig.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{latestVideoConfig.duration}</span>
                    {latestVideoConfig.views && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                        <span>{latestVideoConfig.views}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80 text-primary transition group-hover:scale-105">
                    <Youtube className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </Link>
          )}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Full run breakdowns, gear talk, and farming tips straight from the creator.</p>
            <p className="text-xs">Subscribe so every new upload lands right in your feed.</p>
          </div>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link href={YOUTUBE_CHANNEL} target="_blank" rel="noreferrer">
              Watch Channel
            </Link>
          </Button>
          <Button
            asChild
            className="w-full rounded-full bg-primary/90 text-primary-foreground hover:bg-primary"
          >
            <Link href={DONATION_URL} target="_blank" rel="noreferrer">
              Send Seeds
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
