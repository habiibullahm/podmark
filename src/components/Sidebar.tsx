import { NavLink } from "react-router-dom";
import { useUIStore } from "../store/useUIStore";
import { SIDEBAR_WIDTH_CLASS } from "../lib/sidebarLayout";

const NAV = [
  { path: "/", label: "Home", icon: "🏠", end: true },
  { path: "/library", label: "Library", icon: "🎧", end: false },
  { path: "/insights", label: "Insights", icon: "📊", end: false },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-bg-surface py-6 transition-[width] duration-200 md:flex ${
        collapsed ? `${SIDEBAR_WIDTH_CLASS.collapsed} px-2` : `${SIDEBAR_WIDTH_CLASS.expanded} px-4`
      }`}
    >
      <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            P
          </button>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
                P
              </div>
              <span className="truncate text-lg font-semibold text-text-primary">PodBrain</span>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              [
                "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary",
              ].join(" ")
            }
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/profile"
        title="Profile"
        className={({ isActive }) =>
          [
            "flex items-center rounded-xl py-2.5 transition-colors",
            collapsed ? "justify-center px-0" : "justify-start gap-2 px-3",
            isActive ? "bg-accent/15" : "bg-bg-surface-alt hover:bg-bg-surface-alt/70",
          ].join(" ")
        }
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
          A
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-medium text-text-primary">Alex</p>
            <p className="flex items-center gap-1 text-xs text-text-secondary">🔥 12 day streak</p>
          </div>
        )}
      </NavLink>
    </aside>
  );
}
