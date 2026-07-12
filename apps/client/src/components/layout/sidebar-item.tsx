import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  to: string;
  collapsed?: boolean;
}

export function SidebarItem({ icon: Icon, label, to, collapsed = false }: SidebarItemProps) {
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
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span
        className={`transition-opacity duration-200 whitespace-nowrap ${
          collapsed ? "opacity-0 md:group-hover:opacity-100 hidden md:block md:absolute md:left-14 md:z-50 md:bg-overlay md:px-2 md:py-1 md:rounded-md md:border md:border-separator md:shadow-surface" : "opacity-100"
        }`}
      >
        {label}
      </span>
    </NavLink>
  );
}
