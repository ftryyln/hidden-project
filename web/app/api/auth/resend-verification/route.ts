import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { toApiError } from "@/lib/api/errors";

interface ResendVerificationPayload {
  email: string;
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | ResendVerificationPayload
    | null;

  if (!payload || typeof payload.email !== "string") {
    return NextResponse.json(
      { message: "Invalid resend verification payload" },
      { status: 400 },
    );
  }

  const response = await fetch(
    `${env.public.NEXT_PUBLIC_API_URL}/auth/resend-verification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: payload.email }),
    },
  );

  if (!response.ok) {
    const error = await toApiError(response);
    return NextResponse.json(
      { message: error.message, errors: error.details },
      { status: error.status },
    );
  }

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data, { status: response.status });
}
