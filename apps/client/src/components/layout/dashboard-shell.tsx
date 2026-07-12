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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
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

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 md:py-8">
          <div className="w-full h-full animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out-smooth">
            {children}
          </div>
        </main>

        <footer className="w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 border-t border-separator text-center sm:text-right text-[10px] text-muted">
          <span>ETCRM Version 0.1.0 · Design Engineering Standard</span>
        </footer>
      </div>
    </div>
  );
}
