import { useLocation, useNavigate } from "react-router-dom";

const TABS = [
  { path: "/", label: "Home", icon: "⌂" },
  { path: "/library", label: "Library", icon: "\u{1F3A7}" },
  { path: "/insights", label: "Insights", icon: "\u{1F4CA}" },
  { path: "/profile", label: "Profile", icon: "⚙" },
];

export function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="border-t border-border bg-bg-surface/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <span
                className={`text-lg ${active ? "text-accent" : "text-text-tertiary"}`}
              >
                {tab.icon}
              </span>
              <span
                className={`text-[11px] font-medium ${active ? "text-accent" : "text-text-tertiary"}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
