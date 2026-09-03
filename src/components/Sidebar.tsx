import { NavLink } from "react-router-dom";

const NAV = [
  { path: "/", label: "Home", icon: "⌂", end: true },
  { path: "/library", label: "Library", icon: "🎧", end: false },
  { path: "/insights", label: "Insights", icon: "📊", end: false },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg-surface px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          P
        </div>
        <span className="text-lg font-semibold text-text-primary">PodBrain</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary",
              ].join(" ")
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/profile"
        className={({ isActive }) =>
          [
            "flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors",
            isActive ? "bg-accent/15" : "bg-bg-surface-alt hover:bg-bg-surface-alt/70",
          ].join(" ")
        }
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
          A
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-medium text-text-primary">Alex</p>
          <p className="flex items-center gap-1 text-xs text-text-secondary">🔥 12 day streak</p>
        </div>
      </NavLink>
    </aside>
  );
}
