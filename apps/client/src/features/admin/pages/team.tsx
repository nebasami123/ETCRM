import { useState } from "react";
import { UserPlus, KeyRound, Mail, User, UserRoundX } from "lucide-react";
import { useAdminTeam } from "../hooks/use-admin-team";
import { FormField } from "../../../components/forms/form-field";
import { createUserSchema, resetPasswordSchema } from "../../../lib/validations/users";
import { Card } from "../../../components/ui/card";
import { CustomSelect } from "../../../components/ui/custom-select";
import type { Role, SalesType } from "../../../types";

export function AdminTeam() {
  const teamHook = useAdminTeam();
  
  // Create user form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("SALES");
  const [salesType, setSalesType] = useState<SalesType>("INTERNAL");
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Reset password state
  const [activeResetUserId, setActiveResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateErrors({});

    const result = createUserSchema.safeParse({ name, email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setCreateErrors(fieldErrors);
      return;
    }

    try {
      await teamHook.createSalesUser({ name, email, password, role, salesType });
      setName("");
      setEmail("");
      setPassword("");
    } catch {
      // Handled by hook toast
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetErrors({});

    const result = resetPasswordSchema.safeParse({ newPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setResetErrors(fieldErrors);
      return;
    }

    if (activeResetUserId) {
      await teamHook.resetPassword(activeResetUserId, newPassword);
      setActiveResetUserId(null);
      setNewPassword("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">User & Team Management</h2>
        <p className="text-xs text-muted mt-1">Manage registered users, reset credentials, and audit activity.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Users List */}
        <Card className="rounded-xl border border-separator bg-surface shadow-surface overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-separator bg-default/10">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">All Registered Users</h3>
          </div>
          <div className="overflow-x-auto" data-scrollbar="thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-separator bg-default/20 text-muted font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3 text-center">Role / Type</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator text-foreground font-medium">
                {teamHook.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted">
                      Loading team roster...
                    </td>
                  </tr>
                ) : teamHook.team.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted">
                      No sales agents registered yet.
                    </td>
                  </tr>
                ) : (
                  teamHook.team.map((member) => (
                    <tr key={member.id} className="hover:bg-default/20 transition-colors duration-160">
                      <td className="px-5 py-3.5 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold uppercase">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{member.name}</p>
                          <p className="text-[10px] text-muted">{member.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs font-mono font-bold text-accent uppercase">
                        {member.role || "SALES"}
                        {member.role === "SALES" && <div className="mx-auto mt-1 w-32"><CustomSelect value={member.salesType || "INTERNAL"} onChange={(value) => void teamHook.setSalesType(member.id, value as SalesType)} options={[{ value: "INTERNAL", label: "Internal" }, { value: "EXTERNAL", label: "External" }]} size="sm" /></div>}
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs"><span className={member.banned ? "text-danger" : "text-success"}>{member.banned ? "Inactive" : "Active"}</span></td>
                      <td className="px-5 py-3.5 text-center">
                        {member.role !== "ADMIN" && <button type="button" disabled={teamHook.saving} onClick={() => void teamHook.setUserStatus(member.id, Boolean(member.banned))} className="btn-interactive mr-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border border-border text-foreground hover:bg-default"><UserRoundX className="h-3 w-3" />{member.banned ? "Reactivate" : "Deactivate"}</button>}
                        {member.role !== "ADMIN" &&
                        <button
                          type="button"
                          onClick={() => {
                            setActiveResetUserId(member.id);
                            setNewPassword("");
                            setResetErrors({});
                          }}
                          className="btn-interactive inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border border-border text-foreground hover:bg-default"
                        >
                          <KeyRound className="h-3 w-3 shrink-0" />
                          Reset Password
                        </button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Create Sales Agent Form */}
        <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface h-fit">
          <div className="flex items-center gap-2 mb-3 text-accent">
            <UserPlus className="h-4.5 w-4.5" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Create team account</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Add a sales representative, scoped Sales Admin, or full administrator.
          </p>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <FormField label="Account type" required>
              <CustomSelect value={role} onChange={(value) => setRole(value as Role)} options={[{ value: "SALES", label: "Sales representative" }, { value: "SALES_ADMIN", label: "Sales Admin" }, { value: "ADMIN", label: "Administrator" }]} />
            </FormField>
            {role === "ADMIN" && <p className="-mt-2 text-[11px] leading-relaxed text-muted">Administrators can manage all users and company-wide CRM data.</p>}
            {role === "SALES" && <FormField label="Reporting type" required>
              <CustomSelect value={salesType} onChange={(value) => setSalesType(value as SalesType)} options={[{ value: "INTERNAL", label: "Internal" }, { value: "EXTERNAL", label: "External" }]} />
            </FormField>}
            <FormField label="Full Name" error={createErrors.name} required>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                  placeholder="Jane Doe"
                  required
                />
              </div>
            </FormField>

            <FormField label="Email Address" error={createErrors.email} required>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                  placeholder="jane@etcrm.local"
                  required
                />
              </div>
            </FormField>

            <FormField label="Initial Password" error={createErrors.password} required>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                  placeholder="At least 8 chars"
                  required
                />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={teamHook.saving}
              className="btn-interactive w-full px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {teamHook.saving ? "Creating account..." : role === "ADMIN" ? "Create Administrator" : role === "SALES_ADMIN" ? "Create Sales Admin" : "Add Agent"}
            </button>
          </form>
        </Card>
      </div>

      {/* Reset Password Modal */}
      {activeResetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setActiveResetUserId(null)} />
          <div className="relative w-full max-w-sm rounded-xl border border-separator bg-overlay p-6 shadow-overlay z-10 animate-in fade-in scale-95 duration-200 ease-out-smooth">
            <h3 className="text-base font-bold text-foreground">Reset Agent Password</h3>
            <p className="text-xs text-muted leading-relaxed mt-1">
              Provide a new login password. The agent&apos;s existing active sessions will be immediately terminated.
            </p>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <FormField label="New Password" error={resetErrors.newPassword} required>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
                    placeholder="At least 8 characters"
                    required
                  />
                </div>
              </FormField>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveResetUserId(null)}
                  className="btn-interactive px-3.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamHook.saving}
                  className="btn-interactive px-3.5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90"
                >
                  {teamHook.saving ? "Saving..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminTeam;
