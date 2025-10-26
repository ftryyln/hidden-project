import { createAuthMetadata } from "../metadata";
import { ForgotPasswordPageClient } from "./forgot-password-page.client";

export const metadata = createAuthMetadata({
  title: "Forgot password",
  description: "Request a reset link to regain access to your Guild Manager account.",
});

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
