import type { Metadata } from "next";

interface AuthMetadataInput {
  title: string;
  description?: string;
}

const DEFAULT_DESCRIPTION =
  "Access your Guild Manager account to manage invites, reset passwords, and onboard new members.";

export function createAuthMetadata({ title, description }: AuthMetadataInput): Metadata {
  return {
    title,
    description: description ?? DEFAULT_DESCRIPTION,
  };
}
