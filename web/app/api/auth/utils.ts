import type { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

interface TokenPayload {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
  expires_at?: number | string | null;
}

export function applyAuthCookies(response: NextResponse, tokens: TokenPayload) {
  const { JWT_COOKIE_NAME, JWT_REFRESH_COOKIE_NAME, COOKIE_DOMAIN } = getServerEnv();
  const secure = process.env.NODE_ENV === "production";

  const computeExpiry = (): Date | undefined => {
    if (tokens.expires_at) {
      if (typeof tokens.expires_at === "number") {
        return new Date(tokens.expires_at * 1000);
      }
      const parsed = new Date(tokens.expires_at);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    if (tokens.expires_in) {
      const expiry = new Date();
      expiry.setSeconds(expiry.getSeconds() + tokens.expires_in);
      return expiry;
    }
    return undefined;
  };

  const commonOptions = {
    secure,
    sameSite: "lax" as const,
    path: "/",
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };

  const expires = computeExpiry();
  response.cookies.set({
    name: JWT_COOKIE_NAME,
    value: tokens.access_token,
    ...commonOptions,
    ...(expires ? { expires } : {}),
  });

  if (tokens.refresh_token) {
    response.cookies.set({
      name: JWT_REFRESH_COOKIE_NAME,
      value: tokens.refresh_token,
      ...commonOptions,
    });
  }
}

export function clearAuthCookies(response: NextResponse) {
  const { JWT_COOKIE_NAME, JWT_REFRESH_COOKIE_NAME, COOKIE_DOMAIN } = getServerEnv();
  const secure = process.env.NODE_ENV === "production";

  const commonOptions = {
    secure,
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };

  response.cookies.set({
    name: JWT_COOKIE_NAME,
    value: "",
    ...commonOptions,
  });
  response.cookies.set({
    name: JWT_REFRESH_COOKIE_NAME,
    value: "",
    ...commonOptions,
  });
}
