import {
  LayoutDashboard,
  Users,
  UserCog,
  Target,
  FileBarChart,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Kanban,
  X
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { Logo } from "../../assets/logo";
import { SidebarItem } from "./sidebar-item";

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  const adminNavItems = [
    { icon: LayoutDashboard, label: "Overview", to: "/admin" },
    { icon: Users, label: "Leads", to: "/admin/leads" },
    { icon: UserCog, label: "Team", to: "/admin/team" },
    { icon: Target, label: "Quotas", to: "/admin/quotas" },
    { icon: FileBarChart, label: "Reports & Activity", to: "/admin/reports" },
    { icon: ArrowLeftRight, label: "Transfer Requests", to: "/admin/transfers" }
  ];

  const salesNavItems = [
    { icon: LayoutDashboard, label: "Overview", to: "/sales" },
    { icon: Kanban, label: "Pipeline", to: "/sales/pipeline" },
    { icon: Plus, label: "New Lead", to: "/sales/new" }
  ];

  const navItems = isAdmin ? adminNavItems : salesNavItems;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-surface border-r border-separator transition-all duration-300">
      {/* Top Header */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-separator shrink-0">
        <Logo showText={!collapsed} />
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-default md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto" data-scrollbar="thin">
        {navItems.map((item) => (
          <SidebarItem
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Collapsible Toggle Button (Desktop only) */}
      {onToggleCollapse && (
        <div className="hidden md:flex h-12 items-center justify-end px-3 border-t border-separator shrink-0">
          <button
            onClick={onToggleCollapse}
            className="btn-interactive flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:bg-default hover:text-foreground shadow-surface focus:outline-none"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:block h-screen fixed top-0 left-0 z-30 transition-all duration-300 ${
          collapsed ? "w-17" : "w-60"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/50 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
            onClick={onCloseMobile}
          />

          {/* Drawer Sheet */}
          <div className="relative flex w-60 flex-col h-full bg-surface animate-in slide-in-from-left duration-250 ease-out-fluid shadow-overlay">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
