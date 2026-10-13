import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FilterToolbar } from "../../../components/arc/filter-toolbar/filter-toolbar";
import { SearchField } from "../../../components/arc/search-field/search-field";
import { Card } from "../../../components/ui/card";
import { EmptyState } from "../../../components/ui/empty-state";
import { CustomSelect } from "../../../components/ui/custom-select";
import { LoadingSkeleton } from "../../../components/ui/loading-skeleton";
import { PhaseBadge } from "../../../components/ui/phase-badge";
import { salesAdminApi, type ManagedUser } from "../api";
import type { Lead } from "../../../types";

export function SalesAdminLeads() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const stage = searchParams.get("stage") || "";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [data, users] = await Promise.all([
        salesAdminApi.leads({ search, page: 1, pageSize: 50, stage: stage || undefined }),
        salesAdminApi.team()
      ]);
      setLeads(data.leads);
      setTeam(users.filter((user) => !user.banned));
    } catch {
      setError("Could not load sales-owned leads. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [search, stage]);

  async function assign(lead: Lead, id: string) {
    try {
      await salesAdminApi.assign(lead.id, id || null);
      await load();
    } catch {
      setError("Could not update the lead assignment. Try again.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1>Sales leads</h1>
        <p className="mt-1 text-sm text-muted">Search team-created and team-assigned leads, then reassign them to an active representative.</p>
      </header>

      <Card className="min-w-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-separator p-4">
          <SearchField label="Search sales leads" placeholder="Name or phone" value={search} onValueChange={setSearch} className="w-full max-w-md" />
          <FilterToolbar
            filters={stage ? [{ id: "stage", label: "Pipeline stage", value: stage }] : []}
            onRemove={() => navigate("/sales-admin/leads")}
            onClearAll={() => navigate("/sales-admin/leads")}
          />
        </div>

        {error && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-danger" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="font-medium underline underline-offset-2">Try again</button>
          </div>
        )}

        <div className="overflow-x-auto" aria-busy={loading}>
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr><th>Lead</th><th>Stage</th><th>Assigned rep</th></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <b className="font-medium text-foreground">{lead.fullName}</b>
                    <div className="mt-1 text-xs text-muted">{lead.phoneNumber}</div>
                  </td>
                  <td>
                    <PhaseBadge phase={lead.phase} />
                    <div className="mt-1 text-xs text-muted">{lead.pipelineStage || "—"}</div>
                  </td>
                  <td className="w-56">
                    <CustomSelect
                      value={lead.claimedById || lead.claimedBy?.id || ""}
                      onChange={(id) => void assign(lead, id)}
                      options={[{ value: "", label: "Unassigned" }, ...team.map((user) => ({ value: user.id, label: user.name }))]}
                      searchable
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
              {loading && leads.length === 0 && <tr><td colSpan={3}><LoadingSkeleton type="table" count={3} /></td></tr>}
              {!loading && leads.length === 0 && <tr><td colSpan={3} className="py-2"><EmptyState title="No matching leads" description="Change the search or clear the stage filter to see more leads." /></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
