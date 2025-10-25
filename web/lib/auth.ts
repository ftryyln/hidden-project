import { getCookieConfig } from "@/lib/cookie-config";

function getCookieFromDocument(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

export function getRefreshToken(): string | null {
  const { refreshCookieName } = getCookieConfig();
  return getCookieFromDocument(refreshCookieName);
}

export function hasAccessToken(): boolean {
  return Boolean(getAccessToken());
}

export function getAccessToken(): string | null {
  const { accessCookieName } = getCookieConfig();
  return getCookieFromDocument(accessCookieName);
}
