import { formatDate } from "../../../utils/format";
import type { Activity } from "../../../types";

interface RecentActivityProps {
  activities: Activity[];
  activityLabel: (activity: Activity) => string;
  activityMeta: (activity: Activity) => string;
  onRefresh: () => Promise<void>;
}

export function RecentActivity({ activities, activityLabel, activityMeta, onRefresh }: RecentActivityProps) {
  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Recent Activity</h2>
          <p className="text-sm text-neutral-500">Latest CRM actions by Admin and Sales users.</p>
        </div>
        <button type="button" onClick={onRefresh} className="rounded border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50">
          Refresh
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {activities.length ? (
          activities.map((activity) => (
            <div key={activity.id} className="grid gap-2 rounded border border-line p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
              <div>
                <p className="font-semibold">{activityLabel(activity)}</p>
                <p className="text-sm text-neutral-500">{activityMeta(activity) || "No extra details"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500">User</p>
                <p className="text-sm font-medium">{activity.user?.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-neutral-500">Lead</p>
                <p className="text-sm font-medium">{activity.lead?.fullName || "-"}</p>
              </div>
              <p className="text-sm text-neutral-500">{formatDate(activity.createdAt)}</p>
            </div>
          ))
        ) : (
          <p className="rounded border border-dashed border-line p-4 text-sm text-neutral-500">No activity yet.</p>
        )}
      </div>
    </section>
  );
}
