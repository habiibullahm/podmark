import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useUIStore } from "../store/useUIStore";
import { useIsDesktop } from "../lib/useMediaQuery";
import { SIDEBAR_LEFT_OFFSET_CLASS, SIDEBAR_PADDING_CLASS, UTILITY_PANEL_PADDING_CLASS } from "../lib/sidebarLayout";
import { Sidebar } from "./Sidebar";
import { UtilityPanel } from "./UtilityPanel";
import { BottomTabBar } from "./BottomTabBar";
import { CompactAudioPlayer } from "./CompactAudioPlayer";
import { FullScreenPlayerModal } from "./FullScreenPlayerModal";

// Responsive frame for every screen:
//   desktop (lg+)  sidebar · content · utility panel (player, goal, streak)
//   tablet (md)    icon sidebar · content, mini player docked at the bottom
//   phone          content, mini player above the bottom tab bar
// Player surfaces are rendered (not CSS-hidden) per breakpoint so exactly one
// set of player controls exists at a time.
export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const isDesktop = useIsDesktop();
  const { pathname } = useLocation();
  // The episode workspace is wide and has its own player, so the panel
  // steps aside there.
  const showUtilityPanel = isDesktop && !pathname.startsWith("/episode/");

  const sidebarOffset = collapsed ? SIDEBAR_PADDING_CLASS.collapsed : SIDEBAR_PADDING_CLASS.expanded;
  const fixedBarOffset = collapsed ? SIDEBAR_LEFT_OFFSET_CLASS.collapsed : SIDEBAR_LEFT_OFFSET_CLASS.expanded;

  return (
    <>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only z-50 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <div
        className={`min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-bg-primary transition-[padding] duration-200 ${sidebarOffset} ${
          showUtilityPanel ? UTILITY_PANEL_PADDING_CLASS : ""
        }`}
      >
        <Sidebar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1180px] px-4 pb-44 pt-[calc(env(safe-area-inset-top)+1.25rem)] outline-none sm:px-6 md:pb-28 md:pt-8 lg:px-8 lg:pb-12"
        >
          {children}
        </main>
        {showUtilityPanel && <UtilityPanel />}
      </div>
      {!isDesktop && (
        <div className={`fixed bottom-0 left-0 right-0 z-30 transition-[left] duration-200 ${fixedBarOffset}`}>
          <CompactAudioPlayer />
          <BottomTabBar />
        </div>
      )}
      <FullScreenPlayerModal />
    </>
  );
}
