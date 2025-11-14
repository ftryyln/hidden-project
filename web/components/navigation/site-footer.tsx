"use client";

import Link from "next/link";
import { Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/90 backdrop-blur">
      <div className="container flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            &copy; {new Date().getFullYear()} Guild Manager.
          </p>
          <p className="text-xs uppercase tracking-widest text-muted-foreground/80">
            Developed by Kyuto Fit — keep your guild in sync and your loot fair.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SocialPill
            href="https://discord.com/invite/5mrHnxx8wv"
            icon={<Youtube className="h-4 w-4" />}
            label="YouTube"
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
          />
          <SocialPill
            href="https://discord.gg/kyutofit"
            icon={<DiscordIcon />}
            label="Discord"
            className="border-[#5865F2]/60 text-[#5865F2] hover:bg-[#5865F2]/10"
          />
        </div>
      </div>
    </footer>
  );
}

function SocialPill({
  href,
  icon,
  label,
  className,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold text-foreground transition",
        "hover:border-primary hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function DiscordIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.317 4.369a16.18 16.18 0 0 0-3.978-1.258.06.06 0 0 0-.063.03c-.172.304-.363.7-.497 1.012a14.918 14.918 0 0 0-4.44 0 10.68 10.68 0 0 0-.504-1.012.062.062 0 0 0-.063-.03 16.228 16.228 0 0 0-3.978 1.258.055.055 0 0 0-.025.021C3.16 8.023 2.58 11.588 2.838 15.11a.073.073 0 0 0 .028.054 16.27 16.27 0 0 0 4.995 2.52.06.06 0 0 0 .065-.021c.384-.526.726-1.08 1.02-1.664a.06.06 0 0 0-.033-.083c-.54-.205-1.053-.457-1.534-.75a.06.06 0 0 1-.006-.1c.103-.078.206-.16.304-.244a.06.06 0 0 1 .062-.01c3.214 1.47 6.69 1.47 9.867 0a.06.06 0 0 1 .063.009c.099.084.201.167.304.245a.06.06 0 0 1-.005.1c-.48.293-.993.545-1.535.75a.06.06 0 0 0-.033.083c.3.583.643 1.138 1.02 1.663a.06.06 0 0 0 .065.022 16.258 16.258 0 0 0 5.004-2.521.06.06 0 0 0 .028-.053c.417-5.16-.698-8.69-2.872-10.72a.05.05 0 0 0-.025-.02ZM9.339 13.292c-.973 0-1.773-.89-1.773-1.978 0-1.088.783-1.979 1.773-1.979.99 0 1.794.89 1.774 1.979 0 1.088-.784 1.978-1.774 1.978Zm5.295 0c-.973 0-1.773-.89-1.773-1.978 0-1.088.782-1.979 1.773-1.979s1.794.89 1.774 1.979c0 1.088-.784 1.978-1.774 1.978Z" />
    </svg>
  );
}
