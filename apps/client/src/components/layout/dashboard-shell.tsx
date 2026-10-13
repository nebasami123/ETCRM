import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="crm-shell min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Pane */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          collapsed ? "md:pl-17" : "md:pl-60"
        }`}
      >
        <Topbar onMenuPress={() => setMobileOpen(true)} />

        <main className="mx-auto flex-1 w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="crm-content w-full min-w-0">
            {children}
          </div>
        </main>

        <footer className="mx-auto flex w-full max-w-[1480px] justify-center px-4 py-4 text-[11px] text-muted sm:justify-end sm:px-6 lg:px-8">
          <span>ETCRM · Sales workspace</span>
        </footer>
      </div>
    </div>
  );
}
