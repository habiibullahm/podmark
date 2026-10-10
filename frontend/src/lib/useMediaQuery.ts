import { useSyncExternalStore } from "react";

// Live result of a CSS media query. Layout variants that differ by more than
// styling (the desktop utility panel vs. the mobile mini player, say) are
// *rendered* conditionally with this rather than hidden with CSS, so only one
// copy of each control exists in the DOM — for screen readers, and for tests.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// Tailwind's `lg` breakpoint: three-zone desktop layout from here up.
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
