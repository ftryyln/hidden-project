"use client";

import { createContext, ReactNode, useContext } from "react";

interface DashboardGuildContextValue {
  selectedGuild: string | null;
  changeGuild: (guildId: string) => void;
}

const DashboardGuildContext = createContext<DashboardGuildContextValue | undefined>(undefined);

export function DashboardGuildProvider({
  value,
  children,
}: {
  value: DashboardGuildContextValue;
  children: ReactNode;
}) {
  return <DashboardGuildContext.Provider value={value}>{children}</DashboardGuildContext.Provider>;
}

export function useDashboardGuild() {
  const context = useContext(DashboardGuildContext);
  if (!context) {
    throw new Error("useDashboardGuild must be used within a DashboardGuildProvider");
  }
  return context;
}
