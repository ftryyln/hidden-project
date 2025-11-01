import { createAuthMetadata } from "../metadata";
import { VerifyEmailPageClient } from "./verify-email-page.client";

export const metadata = createAuthMetadata({
  title: "Verify Email",
  description: "Confirm your email address to finish setting up your Guild Manager account.",
});

export default function VerifyEmailPage() {
  return <VerifyEmailPageClient />;
}
