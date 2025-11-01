import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { toApiError } from "@/lib/api/errors";
import { applyAuthCookies } from "@/app/api/auth/utils";

interface ResetPayload {
  code?: string;
  access_token?: string;
  refresh_token?: string | null;
  new_password: string;
}

export async function POST(request: Request) {
  const payload = (await request
    .json()
    .catch(() => null)) as ResetPayload | null;

  if (
    !payload ||
    typeof payload.new_password !== "string" ||
    (!payload.code && !payload.access_token) ||
    (payload.code !== undefined && typeof payload.code !== "string") ||
    (payload.access_token !== undefined && typeof payload.access_token !== "string") ||
    (payload.refresh_token !== undefined && payload.refresh_token !== null && typeof payload.refresh_token !== "string")
  ) {
    return NextResponse.json(
      { message: "Invalid reset payload" },
      { status: 400 },
    );
  }

  const response = await fetch(`${env.public.NEXT_PUBLIC_API_URL}/auth/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
    user: unknown;
  };

  const nextResponse = NextResponse.json({ user: data.user });
  applyAuthCookies(
    nextResponse,
    {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: data.expires_at,
    },
    request.headers.get("host"),
  );

  return nextResponse;
}
