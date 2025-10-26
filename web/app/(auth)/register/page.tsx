import { createAuthMetadata } from "../metadata";
import { RegisterPageClient } from "./register-page.client";

export const metadata = createAuthMetadata({
  title: "Register",
  description: "Create a new Guild Manager account to manage your guild.",
});

export default function RegisterPage() {
  return <RegisterPageClient />;
}
