"use strict";

import { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "@/styles/globals.css";
import { getServerEnv } from "@/lib/env";

export default function RootLayout({ children }: { children: ReactNode }) {
  const serverEnv = getServerEnv();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <Providers
          cookieConfig={{
            accessCookieName: serverEnv.JWT_COOKIE_NAME,
            refreshCookieName: serverEnv.JWT_REFRESH_COOKIE_NAME,
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
