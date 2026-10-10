// Shared class recipes for the design system. Colors, radii and shadows come
// from the tokens in index.css; these only compose them so every card and
// button reads the same. Kept as complete literal strings so Tailwind's
// scanner sees them.

export const CARD = "rounded-card border border-border bg-bg-surface shadow-card";

// Interactive card: lifts its border on hover/focus.
export const CARD_INTERACTIVE = `${CARD} transition-colors hover:border-accent/40`;

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-control text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON_PRIMARY = `${BUTTON_BASE} bg-accent px-4 py-2.5 text-white hover:bg-accent/90`;

export const BUTTON_SECONDARY = `${BUTTON_BASE} border border-border bg-bg-surface px-4 py-2.5 text-text-primary hover:border-accent/50 hover:text-accent`;

export const BUTTON_GHOST = `${BUTTON_BASE} px-3 py-2 text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary`;

export const BUTTON_DANGER = `${BUTTON_BASE} bg-danger px-3 py-1.5 text-xs text-white hover:bg-danger/90`;

// Small icon-only button (needs an aria-label at the call site).
export const ICON_BUTTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg-surface-alt hover:text-text-primary";

// Rounded pill used for secondary actions in a row (episode actions, chips).
export const PILL_BUTTON =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-60";

export const INPUT =
  "w-full rounded-control border border-border bg-bg-surface-alt px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none";

// Dropdown menus (folder menu, note options).
export const MENU = "absolute right-0 top-full z-20 mt-2 rounded-xl border border-border bg-bg-surface p-1.5 shadow-raised";
export const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-text-primary hover:bg-bg-surface-alt";
