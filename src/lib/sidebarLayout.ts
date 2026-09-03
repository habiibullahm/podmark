// Single source of truth for the collapsed/expanded sidebar width, so the
// three places that must agree on it (Sidebar.tsx's own width, App.tsx's
// content padding-left, and App.tsx's fixed player/tab-bar left-offset)
// can't silently drift out of sync. These must stay as complete, static
// Tailwind class strings (not built from interpolated numbers) — Tailwind's
// content scanner matches literal text, not JS expressions.
export const SIDEBAR_WIDTH_CLASS = { collapsed: "w-16", expanded: "w-60" } as const;
export const SIDEBAR_PADDING_CLASS = { collapsed: "md:pl-16", expanded: "md:pl-60" } as const;
export const SIDEBAR_LEFT_OFFSET_CLASS = { collapsed: "md:left-16", expanded: "md:left-60" } as const;
