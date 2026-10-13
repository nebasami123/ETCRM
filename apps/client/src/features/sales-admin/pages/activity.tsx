import { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { ActivityTimeline } from "../../../components/ui/activity-timeline";
import { salesAdminApi } from "../api";
import type { Activity } from "../../../types";

export function SalesAdminActivity() {
  const [activities, setActivities] = useState<Activity[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = () => { setLoading(true); salesAdminApi.activity().then(setActivities).catch(() => setError("Could not load team activity." )).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  return <div className="space-y-5"><div><h1 className="text-xl font-bold text-foreground">Team activity</h1><p className="mt-1 text-xs text-muted">Recent edits, stage changes, calls, and assignment activity for sales-owned leads.</p></div>{error && <p className="text-xs text-danger">{error}</p>}<Card className="rounded-xl border border-separator bg-surface p-4 shadow-surface"><ActivityTimeline activities={activities} onRefresh={load} isLoading={loading}/></Card></div>;
}
