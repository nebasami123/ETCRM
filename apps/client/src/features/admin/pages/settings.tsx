import { useEffect, useState } from "react";
import { Settings, ShieldCheck, Sun, Moon } from "lucide-react";
import { useTheme } from "../../../hooks/use-theme";
import { api } from "../../../api/client";
import { Card } from "../../../components/ui/card";

export function AdminSettings() {
  const { theme, setTheme } = useTheme();
  const [apiVersion, setApiVersion] = useState("Loading...");

  useEffect(() => {
    api.get<{ version: string; build: string }>("/version")
      .then((res) => setApiVersion(`v${res.data.version} · build ${res.data.build.slice(0, 8)}`))
      .catch(() => setApiVersion("Unavailable"));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
        <p className="text-xs text-muted mt-1">Configure workspace parameters and audit platform info.</p>
      </div>

      <div className="grid gap-6 max-w-xl">
        {/* Theme Settings */}
        <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface">
          <div className="flex items-center gap-2 mb-4 text-accent">
            <Settings className="h-4.5 w-4.5" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Appearance Configuration</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Switch between light and dark visual themes for this browser device.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`btn-interactive flex items-center justify-center gap-2 rounded-lg border p-4 text-xs font-semibold transition-all ${
                theme === "light"
                  ? "border-accent bg-accent/5 text-accent font-bold"
                  : "border-border bg-surface text-muted hover:bg-default"
              }`}
            >
              <Sun className="h-4 w-4" />
              Light Theme
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`btn-interactive flex items-center justify-center gap-2 rounded-lg border p-4 text-xs font-semibold transition-all ${
                theme === "dark"
                  ? "border-accent bg-accent/5 text-accent font-bold"
                  : "border-border bg-surface text-muted hover:bg-default"
              }`}
            >
              <Moon className="h-4 w-4" />
              Dark Theme
            </button>
          </div>
        </Card>

        {/* Platform Info */}
        <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface">
          <div className="flex items-center gap-2 mb-3 text-accent">
            <ShieldCheck className="h-4.5 w-4.5" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Platform Diagnostics</h3>
          </div>
          
          <div className="divide-y divide-separator text-xs font-medium mt-2">
            <div className="flex justify-between py-2.5">
              <span className="text-muted">Web Frontend Version</span>
              <span className="font-mono text-foreground">v0.1.0</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-muted">API Connection Version</span>
              <span className="font-mono text-foreground">{apiVersion}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
export default AdminSettings;
