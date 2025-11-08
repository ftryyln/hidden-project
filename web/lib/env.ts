import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_DISCORD_INVITE_URL: z.string().url().optional(),
});

const serverEnvSchema = z.object({
  JWT_COOKIE_NAME: z.string().min(1),
  JWT_REFRESH_COOKIE_NAME: z.string().min(1),
  COOKIE_DOMAIN: z.string().optional(),
});

const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_DISCORD_INVITE_URL: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL,
});

export const env = {
  public: publicEnv,
} as const;

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    JWT_COOKIE_NAME: process.env.JWT_COOKIE_NAME,
    JWT_REFRESH_COOKIE_NAME: process.env.JWT_REFRESH_COOKIE_NAME,
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  });
}
