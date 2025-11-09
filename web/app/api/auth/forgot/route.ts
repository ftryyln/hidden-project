import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { toApiError } from "@/lib/api/errors";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as { email?: string } | null;

  if (!payload || typeof payload.email !== "string") {
    return NextResponse.json({ message: "Invalid email" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const redirectUrl = `${origin}/reset-password`;

  const response = await fetch(`${env.public.NEXT_PUBLIC_API_URL}/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email,
      redirect_to: redirectUrl,
    }),
  });

  if (!response.ok) {
    const error = await toApiError(response);
    return NextResponse.json(
      { message: error.message, errors: error.details },
      { status: error.status },
    );
  }

  return NextResponse.json({ message: "Reset link sent" });
}
