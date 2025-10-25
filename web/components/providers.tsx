"use client";

import { ReactNode, useEffect } from "react";
import { QueryProvider } from "@/lib/query";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { setCookieConfig } from "@/lib/cookie-config";

interface ProvidersProps {
  children: ReactNode;
  cookieConfig: {
    accessCookieName: string;
    refreshCookieName: string;
  };
}

export function Providers({ children, cookieConfig }: ProvidersProps) {
  useEffect(() => {
    document.body.classList.add("bg-background");
  }, []);

  useEffect(() => {
    setCookieConfig(cookieConfig);
  }, [cookieConfig]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
