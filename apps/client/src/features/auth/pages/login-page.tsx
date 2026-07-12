import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../hooks/use-auth";
import { useToast } from "../../../hooks/use-toast";
import { Logo } from "../../../assets/logo";
import { FormField } from "../../../components/forms/form-field";
import { loginSchema } from "../../../lib/validations/auth";
import { Card } from "../../../components/ui/card";
import { Mail, KeyRound } from "lucide-react";

export function LoginPage() {
  const { user, login, isAuthenticated } = useAuth();
  const { danger } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isAuthenticated && user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/sales"} replace />;
  }

  const handleDemoRoleSwitch = (role: "admin" | "sales") => {
    setEmail(role === "admin" ? "admin@etcrm.local" : "sales@etcrm.local");
    setPassword("password123");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sign in. Check credentials.";
      danger(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 transition-colors duration-300">
      <Card className="w-full max-w-sm rounded-xl border border-separator bg-surface p-6 shadow-overlay animate-in fade-in zoom-in-95 duration-300 ease-out-smooth">
        {/* Logo Banner */}
        <div className="flex flex-col items-center text-center">
          <Logo className="scale-110" />
          <h2 className="text-lg font-bold text-foreground mt-4 leading-none">Welcome to ETCRM</h2>
          <p className="text-xs text-muted mt-1 leading-normal">
            Sign in to start your Sales or Admin operation session.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <FormField label="Email Address" error={errors.email} required>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                placeholder="agent@etcrm.local"
                required
              />
            </div>
          </FormField>

          <FormField label="Password" error={errors.password} required>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="btn-interactive w-full px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>

        {/* Demo Accounts Panel */}
        <div className="mt-6 pt-5 border-t border-separator">
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider text-center mb-2.5">
            Demo Credentials Switcher
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold">
            <button
              onClick={() => handleDemoRoleSwitch("admin")}
              className="btn-interactive py-1.5 px-2.5 rounded-lg border border-border bg-surface text-foreground hover:bg-default"
            >
              Demo Admin
            </button>
            <button
              onClick={() => handleDemoRoleSwitch("sales")}
              className="btn-interactive py-1.5 px-2.5 rounded-lg border border-border bg-surface text-foreground hover:bg-default"
            >
              Demo Sales
            </button>
          </div>
        </div>
      </Card>
    </main>
  );
}
export default LoginPage;
