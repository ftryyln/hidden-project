import { createAuthMetadata } from "../metadata";
import { ResetPasswordPageClient } from "./reset-password-page.client";

export const metadata = createAuthMetadata({
  title: "Reset password",
  description: "Update your Guild Manager password using a secure recovery link.",
});

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
