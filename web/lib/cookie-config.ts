interface CookieConfig {
  accessCookieName: string;
  refreshCookieName: string;
}

let config: CookieConfig = {
  accessCookieName: "access_token",
  refreshCookieName: "refresh_token",
};

export function setCookieConfig(nextConfig: CookieConfig) {
  config = nextConfig;
}

export function getCookieConfig(): CookieConfig {
  return config;
}
