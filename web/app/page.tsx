import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";

export default async function RootPage() {
  const cookieJar = await cookies();
  const { JWT_COOKIE_NAME } = getServerEnv();
  const token = cookieJar.get(JWT_COOKIE_NAME)?.value;
  redirect(token ? "/dashboard" : "/login");
}
