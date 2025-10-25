import { NextResponse } from "next/server";
import { env, getServerEnv } from "@/lib/env";
import { toApiError } from "@/lib/api/errors";
import { clearAuthCookies } from "@/app/api/auth/utils";
import { cookies } from "next/headers";

export async function POST() {
  const { JWT_REFRESH_COOKIE_NAME } = getServerEnv();
  const cookieJar = await cookies();
  const refreshToken = cookieJar.get(JWT_REFRESH_COOKIE_NAME)?.value;

  let response: Response;

  try {
    response = await fetch(`${env.public.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
    });
  } catch (error) {
    console.error("Failed to reach auth logout endpoint", error);
    const failed = NextResponse.json({ message: "Unable to contact auth service" }, { status: 502 });
    clearAuthCookies(failed);
    return failed;
  }

  if (!response.ok && response.status !== 204) {
    const error = await toApiError(response);
    const failed = NextResponse.json(
      { message: error.message, errors: error.details },
      { status: error.status },
    );
    clearAuthCookies(failed);
    return failed;
  }

  const success = new NextResponse(null, { status: 204 });
  clearAuthCookies(success);
  return success;
}
