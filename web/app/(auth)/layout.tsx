import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Guild Manager",
    template: "%s | Guild Manager",
  },
  description:
    "Authenticate to Guild Manager to manage guild access, invites, and administrative tasks.",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
