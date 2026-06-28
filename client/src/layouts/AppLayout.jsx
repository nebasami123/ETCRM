import { LogOut } from "lucide-react";
import { useAuth } from "../utils/AuthContext";

export function AppLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-mist">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-forest">ETCRM</p>
            <h1 className="text-2xl font-bold tracking-normal text-ink">{title}</h1>
            {subtitle ? <p className="text-sm text-neutral-500">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-neutral-500">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-white text-neutral-700 hover:bg-neutral-50"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
