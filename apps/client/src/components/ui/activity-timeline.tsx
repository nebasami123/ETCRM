import {
  PhoneCall,
  ArrowRightLeft,
  Calendar,
  PlusCircle,
  Upload,
  UserCheck,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Info
} from "lucide-react";
import type { Activity } from "../../types";
import { formatDateTime } from "../../lib/utils/format";

interface ActivityTimelineProps {
  activities: Activity[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

const icons = {
  CALL_NOTE: PhoneCall,
  PHASE_CHANGED: ArrowRightLeft,
  APPOINTMENT_SET: Calendar,
  LEAD_CREATED: PlusCircle,
  LEAD_IMPORTED: Upload,
  LEAD_CLAIMED: UserCheck,
  FOLLOW_UP_SET: Clock,
  CLAIM_TRANSFER_REQUESTED: ArrowRightLeft,
  CLAIM_TRANSFER_APPROVED: ThumbsUp,
  CLAIM_TRANSFER_REJECTED: ThumbsDown
};

const colors = {
  CALL_NOTE: "bg-accent/15 text-accent border-accent/20",
  PHASE_CHANGED: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  APPOINTMENT_SET: "bg-purple-500/15 text-purple-500 border-purple-500/20",
  LEAD_CREATED: "bg-success/15 text-success border-success/20",
  LEAD_IMPORTED: "bg-teal-500/15 text-teal-500 border-teal-500/20",
  LEAD_CLAIMED: "bg-accent/15 text-accent border-accent/20",
  FOLLOW_UP_SET: "bg-warning/15 text-warning border-warning/20",
  CLAIM_TRANSFER_REQUESTED: "bg-warning/15 text-warning border-warning/20",
  CLAIM_TRANSFER_APPROVED: "bg-success/15 text-success border-success/20",
  CLAIM_TRANSFER_REJECTED: "bg-danger/15 text-danger border-danger/20"
};

const labels = {
  CALL_NOTE: "Call Logged",
  PHASE_CHANGED: "Phase Updated",
  APPOINTMENT_SET: "Appointment Scheduled",
  LEAD_CREATED: "Lead Created",
  LEAD_IMPORTED: "Leads Imported",
  LEAD_CLAIMED: "Lead Claim Updated",
  FOLLOW_UP_SET: "Follow-Up Scheduled",
  CLAIM_TRANSFER_REQUESTED: "Transfer Requested",
  CLAIM_TRANSFER_APPROVED: "Transfer Approved",
  CLAIM_TRANSFER_REJECTED: "Transfer Rejected"
};

export function ActivityTimeline({ activities, onRefresh, isLoading = false }: ActivityTimelineProps) {
  function getMetadata(activity: Activity) {
    if (!activity.metadata) return activity.note || "";
    try {
      const data =
        typeof activity.metadata === "string"
          ? (JSON.parse(activity.metadata as string) as Record<string, unknown>)
          : (activity.metadata as Record<string, unknown>);
      if (data.imported != null) return `Imported ${String(data.imported)} leads, ${String(data.skipped ?? 0)} skipped`;
      if (data.from && data.to) return `Moved phase: ${String(data.from)} → ${String(data.to)}`;
      if (data.appointmentDate) return `Appointment set for ${formatDateTime(data.appointmentDate as string)}`;
      if (data.nextFollowUpAt) return `Follow-up set for ${formatDateTime(data.nextFollowUpAt as string)}`;
      if (data.reason) return `Reason: ${String(data.reason)}`;
      return "";
    } catch {
      return "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Recent Timeline Events</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="text-xs font-semibold text-accent hover:underline focus:outline-none"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-separator text-center text-xs text-muted">
          No timeline events recorded yet.
        </div>
      ) : (
        <div className="relative border-l border-separator pl-4 ml-3 space-y-5 py-1">
          {activities.map((activity) => {
            const Icon = icons[activity.type] || Info;
            return (
              <div key={activity.id} className="relative group animate-in fade-in slide-in-from-left-2 duration-200">
                {/* timeline dot connector */}
                <div
                  className={`absolute -left-7.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border bg-overlay shadow-surface ${
                    colors[activity.type] || "bg-default/20 text-muted border-separator"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                  <div>
                    <span className="text-xs font-bold text-foreground">
                      {labels[activity.type] || activity.type}
                    </span>
                    {activity.actor && (
                      <span className="text-[10px] text-muted ml-1.5 font-medium">
                        by {activity.actor.name}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted font-medium font-mono shrink-0">
                    {formatDateTime(activity.createdAt)}
                  </span>
                </div>

                {activity.lead && (
                  <p className="text-[11px] font-bold text-accent/90 mt-0.5">
                    Lead: {activity.lead.fullName}
                  </p>
                )}

                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {getMetadata(activity)}
                </p>

                {activity.note && (
                  <div className="mt-1.5 rounded-lg border border-separator bg-default/40 p-2.5 text-xs text-foreground italic leading-normal">
                    &ldquo;{activity.note}&rdquo;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
