import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
  collapsed?: boolean;
  badge?: number;
}

export function SidebarItem({ icon: Icon, label, to, collapsed = false, badge }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/admin" || to === "/sales"}
      className={({ isActive }) =>
        `btn-interactive group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none ${
          isActive
            ? "bg-accent/10 text-accent font-bold"
            : "text-muted hover:bg-default hover:text-foreground"
        }`
      }
    >
      <span className="relative shrink-0">
        <Icon className="h-4.5 w-4.5" />
        {typeof badge === "number" && badge > 0 && collapsed && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[8px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span
        className={`flex flex-1 items-center justify-between gap-2 transition-opacity duration-200 whitespace-nowrap ${
          collapsed
            ? "opacity-0 md:group-hover:opacity-100 hidden md:block md:absolute md:left-14 md:z-50 md:bg-overlay md:px-2 md:py-1 md:rounded-md md:border md:border-separator md:shadow-surface"
            : "opacity-100"
        }`}
      >
        <span>{label}</span>
        {typeof badge === "number" && badge > 0 && !collapsed && (
          <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold text-danger">{badge > 99 ? "99+" : badge}</span>
        )}
      </span>
    </NavLink>
  );
}
