import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { useAdminActivity } from "../hooks/use-admin-activity";
import { ActivityTimeline } from "../../../components/ui/activity-timeline";
import { Card } from "../../../components/ui/card";
import { todayInputValue } from "../../../lib/utils/format";

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

export function AdminReports() {
  const activityHook = useAdminActivity();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayInputValue);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Reports & Activity log</h2>
        <p className="text-xs text-muted mt-1">Audit collaborative sales behavior and export agent metrics.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface h-fit">
          <div className="flex items-center gap-2 mb-3 text-accent">
            <FileText className="h-4.5 w-4.5" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Export performance data</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Download spreadsheet data for call volumes, conversions, appointments, and activity in a business-day date range.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-field-border bg-field-background px-2 py-1.5 text-xs"
              />
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-field-border bg-field-background px-2 py-1.5 text-xs"
              />
            </label>
          </div>

          <button
            disabled={activityHook.exporting || !from || !to}
            onClick={() => activityHook.downloadReport({ from, to })}
            className="btn-interactive w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-4 w-4 shrink-0 inline-block" />
            {activityHook.exporting ? "Generating report..." : "Download CSV Report"}
          </button>
        </Card>

        <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface lg:col-span-2">
          {activityHook.isLoading ? (
            <div className="text-center py-12 text-muted text-xs">Loading operations timeline...</div>
          ) : (
            <ActivityTimeline activities={activityHook.activities} onRefresh={activityHook.refresh} />
          )}
        </Card>
      </div>
    </div>
  );
}

export default AdminReports;
