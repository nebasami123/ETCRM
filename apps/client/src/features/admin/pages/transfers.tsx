import { ArrowRightLeft, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAdminTransfers } from "../hooks/use-admin-transfers";
import { Card } from "../../../components/ui/card";

export function AdminTransfers() {
  const transfersHook = useAdminTransfers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Claim Transfer Requests</h2>
        <p className="text-xs text-muted mt-1">
          Review and resolve conflicts when agents request ownership of claimed leads.
        </p>
      </div>

      {transfersHook.isLoading ? (
        <div className="text-center py-12 text-muted text-xs">
          Loading pending transfer conflicts...
        </div>
      ) : transfersHook.requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 border border-dashed border-separator rounded-xl text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/5 text-accent mb-3">
            <ArrowRightLeft className="h-6 w-6" />
          </div>
          <h4 className="text-xs font-bold text-foreground">Clean queue</h4>
          <p className="text-[11px] text-muted mt-1 max-w-62.5 leading-relaxed">
            There are no pending claim transfer conflicts requiring authorization.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {transfersHook.requests.map((req) => (
            <Card
              key={req.id}
              className="rounded-xl border border-separator bg-surface p-5 shadow-surface flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-separator pb-3 mb-3">
                  <span className="text-[10px] font-bold text-accent uppercase bg-accent/5 px-2 py-0.5 rounded-full">
                    Requested Transfer
                  </span>
                  <span className="text-[9px] text-muted font-mono font-medium">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Lead: {req.lead.fullName}</h4>
                  <p className="text-[10px] text-muted font-mono">{req.lead.phoneNumber}</p>
                </div>

                <div className="mt-3.5 space-y-1">
                  <p className="text-[10px] text-muted font-semibold">Requested By</p>
                  <p className="text-xs font-bold text-foreground">{req.requestedBy.name}</p>
                </div>

                <div className="mt-3.5 rounded-lg border border-separator bg-default/45 p-2.5 text-xs text-foreground italic leading-normal">
                  &ldquo;{req.reason}&rdquo;
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-5">
                <button
                  onClick={() => transfersHook.resolveRequest(req.id, false)}
                  className="btn-interactive inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-danger/30 text-danger hover:bg-danger/10"
                >
                  <ThumbsDown className="h-3.5 w-3.5 shrink-0 inline-block" />
                  Reject
                </button>
                <button
                  onClick={() => transfersHook.resolveRequest(req.id, true)}
                  className="btn-interactive inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-accent text-accent-foreground hover:opacity-90"
                >
                  <ThumbsUp className="h-3.5 w-3.5 shrink-0 inline-block" />
                  Approve
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
export default AdminTransfers;
