import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

// First-ever visit: default collapsed below 1280px (where a full sidebar plus
// the utility panel would crowd the content) and expanded on wide screens.
// Any explicit user toggle after that is persisted and wins from then on.
function getDefaultCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1280;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: getDefaultCollapsed(),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "podmark-ui" },
  ),
);
