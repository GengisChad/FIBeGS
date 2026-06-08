import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

type Ctx = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
};

const SidebarStateContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "right-sidebar-collapsed";

export const SidebarStateProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);
  const toggle = useCallback(() => setCollapsed(v => !v), []);
  return (
    <SidebarStateContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarStateContext.Provider>
  );
};

export const useSidebarState = () => {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) throw new Error("useSidebarState must be inside SidebarStateProvider");
  return ctx;
};
