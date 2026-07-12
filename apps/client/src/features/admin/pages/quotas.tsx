import { useState, useEffect } from "react";
import { Phone, CheckSquare, CalendarDays } from "lucide-react";
import { useAdminQuotas } from "../hooks/use-admin-quotas";
import { Card } from "../../../components/ui/card";

export function AdminQuotas() {
  const quotasHook = useAdminQuotas();

  // Temporary local state for each agent's quota to prevent layout thrashing
  const [localTargets, setLocalTargets] = useState<Record<string, { calls: number; leads: number }>>({});

  useEffect(() => {
    const targets: Record<string, { calls: number; leads: number }> = {};
    quotasHook.salesUsers.forEach((user) => {
      const q = quotasHook.quotas.find((quota) => quota.salesUserId === user.id);
      targets[user.id] = {
        calls: q?.callsTarget ?? 10,
        leads: q?.leadsTarget ?? 5
      };
    });
    setLocalTargets(targets);
  }, [quotasHook.quotas, quotasHook.salesUsers]);

  const updateLocalTarget = (userId: string, field: "calls" | "leads", val: number) => {
    setLocalTargets((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: Math.max(0, val)
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Quota Management</h2>
          <p className="text-xs text-muted mt-1">Set daily targets for call note logging and lead status updates.</p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-1.5 shadow-surface w-fit">
          <CalendarDays className="h-4.5 w-4.5 text-accent shrink-0" />
          <input
            type="date"
            value={quotasHook.date}
            onChange={(e) => quotasHook.setDate(e.target.value)}
            className="text-xs font-semibold text-foreground bg-transparent focus:outline-none"
            aria-label="Select target date"
          />
        </div>
      </div>

      {/* Quotas grid */}
      {quotasHook.isLoading ? (
        <div className="text-center py-12 text-muted text-xs">
          Loading team targets...
        </div>
      ) : quotasHook.salesUsers.length === 0 ? (
        <div className="text-center py-12 text-muted text-xs border border-dashed border-separator rounded-xl">
          Register sales representatives first to manage daily targets.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quotasHook.salesUsers.map((user) => {
            const targets = localTargets[user.id] || { calls: 10, leads: 5 };
            return (
              <Card
                key={user.id}
                className="rounded-xl border border-separator bg-surface p-5 shadow-surface flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent font-bold uppercase text-xs">
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-foreground">{user.name}</span>
                  </div>

                  <div className="space-y-4">
                    {/* Calls target */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
                        <Phone className="h-3.5 w-3.5" />
                        Call Target
                      </span>
                      <div className="flex items-center border border-field-border rounded-lg bg-field-background overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateLocalTarget(user.id, "calls", targets.calls - 1)}
                          className="px-2 py-1 text-xs text-muted hover:bg-default"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={targets.calls}
                          onChange={(e) => updateLocalTarget(user.id, "calls", parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-xs font-bold text-foreground bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateLocalTarget(user.id, "calls", targets.calls + 1)}
                          className="px-2 py-1 text-xs text-muted hover:bg-default"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Leads target */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
                        <CheckSquare className="h-3.5 w-3.5" />
                        Processed Target
                      </span>
                      <div className="flex items-center border border-field-border rounded-lg bg-field-background overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateLocalTarget(user.id, "leads", targets.leads - 1)}
                          className="px-2 py-1 text-xs text-muted hover:bg-default"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={targets.leads}
                          onChange={(e) => updateLocalTarget(user.id, "leads", parseInt(e.target.value) || 0)}
                          className="w-10 text-center text-xs font-bold text-foreground bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateLocalTarget(user.id, "leads", targets.leads + 1)}
                          className="px-2 py-1 text-xs text-muted hover:bg-default"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => quotasHook.saveQuota(user.id, targets.calls, targets.leads)}
                  className="btn-interactive mt-5 w-full text-xs font-semibold bg-accent text-accent-foreground rounded-lg py-1.5 hover:opacity-90"
                >
                  Save Quotas
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default AdminQuotas;
