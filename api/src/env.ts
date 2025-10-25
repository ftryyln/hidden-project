import "dotenv/config";

const NODE_ENV = process.env.NODE_ENV ?? "development";
const PORT = Number(process.env.PORT ?? 8080);
const API_PREFIX = process.env.API_PREFIX ?? "/api/v1";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_API_URL ??
  "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? "access_token";
const JWT_REFRESH_COOKIE_NAME = process.env.JWT_REFRESH_COOKIE_NAME ?? "refresh_token";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const REGISTRATION_REDIRECT_URL = process.env.REGISTRATION_REDIRECT_URL ?? null;
const RESET_PASSWORD_REDIRECT_URL = process.env.RESET_PASSWORD_REDIRECT_URL ?? null;

if (!SUPABASE_URL) {
  console.warn("SUPABASE_URL is not set. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Auth-protected routes will fail.");
}

if (!SUPABASE_ANON_KEY) {
  console.warn("SUPABASE_ANON_KEY is not set. Password-based auth may fail.");
}

export const config = {
  nodeEnv: NODE_ENV,
  port: PORT,
  apiPrefix: API_PREFIX,
  supabaseUrl: SUPABASE_URL,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  jwtCookieName: JWT_COOKIE_NAME,
  jwtRefreshCookieName: JWT_REFRESH_COOKIE_NAME,
  frontendUrl: FRONTEND_URL,
  registrationRedirectUrl: REGISTRATION_REDIRECT_URL,
  resetPasswordRedirectUrl: RESET_PASSWORD_REDIRECT_URL,
} as const;
