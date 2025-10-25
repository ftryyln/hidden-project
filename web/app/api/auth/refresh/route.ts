import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { toApiError } from "@/lib/api/errors";
import { applyAuthCookies } from "@/app/api/auth/utils";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

export async function POST() {
  const { JWT_REFRESH_COOKIE_NAME } = getServerEnv();
  const cookieJar = await cookies();
  const refreshToken = cookieJar.get(JWT_REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { message: "Missing refresh token" },
      { status: 401 },
    );
  }

  const response = await fetch(`${env.public.NEXT_PUBLIC_API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const error = await toApiError(response);
    return NextResponse.json(
      { message: error.message, errors: error.details },
      { status: error.status },
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string | null;
    expires_in?: number | null;
    expires_at?: number | string | null;
    user?: unknown;
  };

  const nextResponse = NextResponse.json({ user: data.user });
  applyAuthCookies(nextResponse, {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in,
    expires_at: data.expires_at,
  });
  return nextResponse;
}
