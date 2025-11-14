"use client";

import { useMemo } from "react";

interface YoutubePlayerProps {
  videoUrl: string;
  title: string;
}

export default function YoutubePlayer({ videoUrl, title }: YoutubePlayerProps) {
  const embedUrl = useMemo(() => {
    try {
      const parsed = new URL(videoUrl);
      if (parsed.hostname === "youtu.be") {
        return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}?rel=0`;
      }
      if (parsed.searchParams.has("v")) {
        return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}?rel=0`;
      }
      const segments = parsed.pathname.split("/");
      const embedIndex = segments.indexOf("embed");
      if (embedIndex !== -1 && segments[embedIndex + 1]) {
        return `https://www.youtube.com/embed/${segments[embedIndex + 1]}?rel=0`;
      }
      return videoUrl;
    } catch {
      return videoUrl;
    }
  }, [videoUrl]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
      <div className="relative pb-[56.25%]">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}
