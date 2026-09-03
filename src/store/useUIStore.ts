import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

// First-ever visit: default collapsed on narrower desktop widths (where a
// full 240px sidebar would crowd the content) and expanded on wide screens.
// Any explicit user toggle after that is persisted and wins from then on.
function getDefaultCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1024;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: getDefaultCollapsed(),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "podbrain-ui" },
  ),
);
