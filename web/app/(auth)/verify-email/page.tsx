import { Suspense } from "react";
import { createAuthMetadata } from "../metadata";
import { VerifyEmailPageClient } from "./verify-email-page.client";

export const metadata = createAuthMetadata({
  title: "Verify Email",
  description: "Confirm your email address to finish setting up your Guild Manager account.",
});

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <VerifyEmailPageClient />
    </Suspense>
  );
}
