import { useState } from "react";
import { LogOut, KeyRound, Menu } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { authClient } from "../../lib/auth-client";
import { changePasswordSchema } from "../../lib/validations/users";
import { Breadcrumbs } from "./breadcrumbs";
import { ThemeSwitch } from "../ui/theme-switch";

interface TopbarProps {
  onMenuPress?: () => void;
}

export function Topbar({ onMenuPress }: TopbarProps) {
  const { user, logout } = useAuth();
  const { success, danger } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Change password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setSaving(false);
      return;
    }

    try {
      const response = await authClient.changePassword({
        currentPassword,
        newPassword
      });
      
      if (response.error) {
        throw new Error(response.error.message || "Failed to change password");
      }

      success("Password updated successfully");
      setModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      danger(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-separator bg-surface/80 px-4 backdrop-blur-md transition-colors duration-300">
      <div className="flex items-center gap-3">
        {onMenuPress && (
          <button
            onClick={onMenuPress}
            className="btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-surface hover:bg-default md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="hidden sm:block">
          <Breadcrumbs />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeSwitch />

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn-interactive flex items-center gap-2 rounded-lg border border-border bg-surface p-1.5 text-left text-sm shadow-surface hover:bg-default/50"
            aria-expanded={dropdownOpen}
            aria-haspopup="menu"
          >
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block pr-1">
              <p className="text-xs font-semibold leading-none text-foreground">{user.name}</p>
              <p className="text-[10px] text-muted font-medium mt-0.5 leading-none">{user.role}</p>
            </div>
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay backdrop to close dropdown */}
              <div 
                className="fixed inset-0 z-40 bg-transparent" 
                onClick={() => setDropdownOpen(false)}
              />
              <div 
                className="absolute right-0 mt-1.5 w-48 origin-top-right rounded-lg border border-separator bg-overlay p-1 shadow-overlay z-50 animate-in fade-in scale-95 duration-150 ease-out-smooth"
                role="menu"
              >
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    setModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-default transition-colors duration-150"
                  role="menuitem"
                >
                  <KeyRound className="h-4 w-4 text-muted" />
                  Change Password
                </button>
                <div className="my-1 border-t border-separator" />
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-danger hover:bg-danger/10 transition-colors duration-150"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Modal Backdrop with blur */}
          <div 
            className="fixed inset-0 bg-background/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => !saving && setModalOpen(false)}
          />
          
          <div className="relative w-full max-w-sm rounded-xl border border-separator bg-overlay p-6 shadow-overlay animate-in fade-in scale-95 duration-200 ease-out-smooth">
            <h3 className="text-lg font-bold text-foreground">Change Password</h3>
            <p className="text-xs text-muted mt-1">Keep your workspace secure by updating your password.</p>

            <form onSubmit={handlePasswordChange} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-sm text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                  required
                />
                {errors.currentPassword && (
                  <p className="text-[11px] text-danger mt-1 font-medium">{errors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-sm text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                  required
                />
                {errors.newPassword && (
                  <p className="text-[11px] text-danger mt-1 font-medium">{errors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-sm text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                  required
                />
                {errors.confirmPassword && (
                  <p className="text-[11px] text-danger mt-1 font-medium">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="flex justify-end gap-2.5 mt-5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="btn-interactive px-3.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-interactive px-3.5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
