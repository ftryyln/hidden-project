import { createAuthMetadata } from "../metadata";
import { LoginPageClient } from "./login-page.client";

export const metadata = createAuthMetadata({
  title: "Login",
  description: "Sign in to manage your guilds and member access.",
});

export default function LoginPage() {
  return <LoginPageClient />;
}
