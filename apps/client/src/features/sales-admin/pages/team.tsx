import { useEffect, useState } from "react";
import { KeyRound, UserPlus, UserRoundX, X } from "lucide-react";
import { Card } from "../../../components/ui/card";
import { CustomSelect } from "../../../components/ui/custom-select";
import { FormField } from "../../../components/forms/form-field";
import { salesAdminApi, type ManagedUser } from "../api";
import type { SalesType } from "../../../types";

export function SalesAdminTeam() {
  const [team, setTeam] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [salesType, setSalesType] = useState<SalesType>("INTERNAL");
  const [activeResetUser, setActiveResetUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadTeam() {
    try {
      setTeam(await salesAdminApi.team());
    } catch {
      setMessage("Could not load the sales team.");
    }
  }

  useEffect(() => {
    void loadTeam();
  }, []);

  async function createSalesUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await salesAdminApi.createRep({ name, email, password, salesType });
      setName("");
      setEmail("");
      setPassword("");
      setMessage("Sales account created.");
      await loadTeam();
    } catch {
      setMessage("Could not create account. Check that this email is not already in use.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!activeResetUser) return;
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await salesAdminApi.resetPassword(activeResetUser.id, newPassword);
      setMessage(`Password reset. ${activeResetUser.name}'s active sessions have been ended.`);
      setActiveResetUser(null);
      setNewPassword("");
    } catch {
      setMessage("Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeType(user: ManagedUser, value: string) {
    const salesType = value as SalesType;
    setTeam((users) => users.map((row) => row.id === user.id ? { ...row, salesType } : row));
    try {
      await salesAdminApi.setType(user.id, salesType);
    } catch {
      setMessage("Could not update reporting category.");
      await loadTeam();
    }
  }

  async function toggleStatus(user: ManagedUser) {
    setBusy(true);
    try {
      await salesAdminApi.setStatus(user.id, Boolean(user.banned));
      await loadTeam();
    } catch {
      setMessage("Could not change this account's status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Sales team</h1>
        <p className="mt-1 text-xs text-muted">Create and maintain sales representative accounts. Type is used for reporting only.</p>
      </div>

      {message && <p role="status" className="rounded-lg border border-separator bg-surface px-3 py-2 text-xs text-muted">{message}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden rounded-xl border border-separator bg-surface shadow-surface">
          <div className="border-b border-separator px-4 py-3 text-sm font-bold text-foreground">Sales representatives</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[670px] text-left text-xs">
              <thead className="bg-default/20 text-[10px] uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Representative</th>
                  <th className="px-4 py-3">Reporting type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {team.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <b className="text-foreground">{user.name}</b>
                      <div className="mt-0.5 text-[10px] text-muted">{user.email}</div>
                    </td>
                    <td className="w-40 px-4 py-3">
                      <CustomSelect
                        value={user.salesType || "INTERNAL"}
                        onChange={(value) => void changeType(user, value)}
                        options={[
                          { value: "INTERNAL", label: "Internal" },
                          { value: "EXTERNAL", label: "External" }
                        ]}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={user.banned ? "text-danger" : "text-success"}>{user.banned ? "Inactive" : "Active"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => { setActiveResetUser(user); setNewPassword(""); }}
                          className="btn-interactive inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-foreground"
                        >
                          <KeyRound className="h-3 w-3" />Reset
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void toggleStatus(user)}
                          className="btn-interactive inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-foreground"
                        >
                          <UserRoundX className="h-3 w-3" />{user.banned ? "Reactivate" : "Deactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {team.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Loading or no sales reps yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="h-fit rounded-xl border border-separator bg-surface p-4 shadow-surface">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-foreground">Create sales account</h2>
          </div>
          <form className="space-y-3" onSubmit={(event) => void createSalesUser(event)}>
            <FormField label="Full name" required>
              <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground" required />
            </FormField>
            <FormField label="Email" required>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground" required />
            </FormField>
            <FormField label="Initial password" required>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground" minLength={8} required />
            </FormField>
            <FormField label="Reporting type" required>
              <CustomSelect
                value={salesType}
                onChange={(value) => setSalesType(value as SalesType)}
                options={[
                  { value: "INTERNAL", label: "Internal" },
                  { value: "EXTERNAL", label: "External" }
                ]}
              />
            </FormField>
            <button disabled={busy} className="btn-interactive w-full rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground disabled:opacity-50">
              {busy ? "Saving…" : "Create account"}
            </button>
          </form>
        </Card>
      </div>

      {activeResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reset-sales-password-title">
          <button aria-label="Close password reset" className="fixed inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setActiveResetUser(null)} />
          <Card className="relative z-10 w-full max-w-sm rounded-xl border border-separator bg-overlay p-5 shadow-overlay">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="reset-sales-password-title" className="text-base font-bold text-foreground">Reset password</h2>
                <p className="mt-1 text-xs text-muted">Set a new password for {activeResetUser.name}. Their active sessions will end.</p>
              </div>
              <button aria-label="Close" onClick={() => setActiveResetUser(null)} className="rounded-md p-1 text-muted hover:bg-default"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={(event) => void resetPassword(event)} className="mt-4 space-y-4">
              <FormField label="New password" required>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground" minLength={8} required />
              </FormField>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setActiveResetUser(null)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground">Cancel</button>
                <button disabled={busy} className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground">{busy ? "Saving…" : "Reset password"}</button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
