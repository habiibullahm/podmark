// Single source of truth for the collapsed/expanded sidebar width, so the
// places that must agree on it (Sidebar.tsx's own width, AppShell's content
// padding-left, and the fixed player/tab-bar left offset) can't silently
// drift out of sync. These must stay as complete, static Tailwind class
// strings (not built from interpolated numbers) — Tailwind's content scanner
// matches literal text, not JS expressions.
export const SIDEBAR_WIDTH_CLASS = { collapsed: "w-[76px]", expanded: "w-64" } as const;
export const SIDEBAR_PADDING_CLASS = { collapsed: "md:pl-[76px]", expanded: "md:pl-64" } as const;
export const SIDEBAR_LEFT_OFFSET_CLASS = { collapsed: "md:left-[76px]", expanded: "md:left-64" } as const;

// The desktop utility panel on the right (lg+), and the matching gutter.
export const UTILITY_PANEL_WIDTH_CLASS = "w-72 xl:w-80";
export const UTILITY_PANEL_PADDING_CLASS = "lg:pr-72 xl:pr-80";
