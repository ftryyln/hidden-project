import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ApiClientError, toApiError } from "@/lib/api/errors";
import { applyAuthCookies } from "@/app/api/auth/utils";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);

    if (
      !payload ||
      typeof payload.email !== "string" ||
      typeof payload.password !== "string"
    ) {
      return NextResponse.json(
        { message: "Invalid login payload" },
        { status: 400 },
      );
    }

    const response = await fetch(`${env.public.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await toApiError(response);
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
  } catch (error) {
    const apiError =
      error instanceof ApiClientError ? error : await toApiError(error);
    const status = apiError.status === 0 ? 503 : apiError.status ?? 500;
    return NextResponse.json(
      { message: apiError.message, errors: apiError.details },
      { status },
    );
  }
}
