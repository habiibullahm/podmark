import { NavLink } from "react-router-dom";
import { PRIMARY_NAV, PROFILE_NAV } from "../lib/navigation";

const TABS = [...PRIMARY_NAV, PROFILE_NAV];

// Phone navigation (below md). Links, not buttons, so they're announced and
// behave as navigation.
export function BottomTabBar() {
  return (
    <nav aria-label="Main" className="border-t border-border bg-bg-surface/95 backdrop-blur md:hidden">
      <div className="flex items-stretch justify-around px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              `flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors ${
                isActive ? "text-accent" : "text-text-tertiary hover:text-text-primary"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    isActive ? "bg-accent/10" : ""
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
