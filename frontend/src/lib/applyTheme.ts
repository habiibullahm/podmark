import type { ThemePreference } from "../store/useThemeStore";

const THEME_STORAGE_KEY = "podmark-theme";

function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return "system";
    const theme = (JSON.parse(raw) as { state?: { theme?: string } })?.state?.theme;
    return theme === "light" || theme === "dark" ? theme : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: ThemePreference): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

// Runs at import time, before React mounts — reading localStorage directly
// rather than waiting on the store's own persist hydration and a React
// effect, both of which would only apply the attribute after first paint
// and flash the wrong theme for a frame.
applyTheme(readStoredTheme());
