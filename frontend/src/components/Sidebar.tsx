import { NavLink } from "react-router-dom";
import { AudioLines, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useUIStore } from "../store/useUIStore";
import { useAuthStore } from "../store/useAuthStore";
import { getAvatarLetter, getDisplayName } from "../lib/identity";
import { isAccountsConfigured } from "../lib/neon";
import { SIDEBAR_WIDTH_CLASS } from "../lib/sidebarLayout";
import { PRIMARY_NAV } from "../lib/navigation";

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const accountDetail = status === "signedIn" ? "Signed in" : isAccountsConfigured ? "Sign in to sync" : "Saved on this device";

  return (
    <aside
      aria-label="Primary"
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-bg-sidebar py-6 transition-[width] duration-200 md:flex ${
        collapsed ? `${SIDEBAR_WIDTH_CLASS.collapsed} px-3` : `${SIDEBAR_WIDTH_CLASS.expanded} px-4`
      }`}
    >
      <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-between pl-2"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={18} aria-hidden="true" />
          </button>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                <AudioLines size={18} aria-hidden="true" />
              </span>
              <span className="truncate text-xl font-extrabold tracking-tight text-text-primary">PodMark</span>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary hover:bg-bg-surface-alt hover:text-text-primary"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Menu</p>
      )}
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {PRIMARY_NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              [
                "group relative flex items-center rounded-xl py-2.5 text-sm font-semibold transition-colors",
                collapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span aria-hidden="true" className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-accent" />
                )}
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/profile"
        title={collapsed ? "Profile" : undefined}
        aria-label={collapsed ? "Profile" : undefined}
        className={({ isActive }) =>
          [
            "flex items-center rounded-2xl py-2.5 transition-colors",
            collapsed ? "justify-center px-0" : "justify-start gap-3 px-2.5",
            isActive ? "bg-accent/10" : "hover:bg-bg-surface-alt",
          ].join(" ")
        }
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
          {getAvatarLetter(user)}
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="line-clamp-1 text-sm font-bold text-text-primary">{getDisplayName(user)}</span>
            <span className="line-clamp-1 text-xs text-text-tertiary">{accountDetail}</span>
          </span>
        )}
      </NavLink>
    </aside>
  );
}
