import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "../../../utils/format";
import type { Activity } from "../../../types";

export function CallHistory({ events }: { events: Activity[] }) {
  return <div><h3 className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 size={19} />Activity timeline</h3><div className="mt-3 space-y-3">{events.length ? events.map((event) => <div key={event.id} className="rounded border border-line p-3"><div className="flex items-center justify-between gap-3 text-xs text-neutral-500"><span>{event.actor?.name || "System"} · {event.type.replace(/_/g, " ")}</span><span>{formatDateTime(event.createdAt)}</span></div>{event.note ? <p className="mt-2 text-sm leading-6">{event.note}</p> : null}{event.creditedUser ? <p className="mt-2 text-xs text-forest">Conversion credit: {event.creditedUser.name}</p> : null}</div>) : <p className="rounded border border-dashed border-line p-5 text-sm text-neutral-500">No activity yet.</p>}</div></div>;
}
