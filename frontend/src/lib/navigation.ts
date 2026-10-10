import type { LucideIcon } from "lucide-react";
import { ChartColumn, CircleUserRound, Compass, House, LibraryBig } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

// Shared by the desktop sidebar and the mobile tab bar so they never drift.
export const PRIMARY_NAV: NavItem[] = [
  { path: "/", label: "Home", icon: House, end: true },
  { path: "/discover", label: "Discover", icon: Compass, end: false },
  { path: "/library", label: "Library", icon: LibraryBig, end: false },
  { path: "/insights", label: "Insights", icon: ChartColumn, end: false },
];

export const PROFILE_NAV: NavItem = { path: "/profile", label: "Profile", icon: CircleUserRound, end: false };
