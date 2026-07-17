import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, ArrowRight } from "lucide-react";
import { salesApi } from "../api";
import type { SalesCampaign } from "../../../types";
import { Card } from "../../../components/ui/card";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PAUSED: "bg-warning/15 text-warning",
  CLOSED: "bg-danger/15 text-danger",
  DRAFT: "bg-default text-muted"
};

export function SalesCampaigns() {
  const navigate = useNavigate();
  const { danger } = useToast();
  const [campaigns, setCampaigns] = useState<SalesCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    salesApi
      .getCampaigns()
      .then((rows) => {
        if (!cancelled) setCampaigns(rows);
      })
      .catch((err) => {
        if (!cancelled) danger(getErrorMessage(err, "Failed to load campaigns"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [danger]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-separator bg-linear-to-r from-surface via-surface to-accent/5 px-5 py-6 sm:px-7">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Sales workspace</p>
        <h1 className="relative mt-1 text-2xl font-black tracking-tight text-foreground">My campaigns</h1>
        <p className="relative mt-1 max-w-2xl text-xs leading-relaxed text-muted">
          Campaigns assigned to you. Open one to start calling those leads.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-muted">Loading campaigns…</div>
      ) : campaigns.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-separator p-10 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm font-semibold text-foreground">No active campaigns</p>
          <p className="mt-1 text-xs text-muted">When admin launches a campaign for you, it will show up here.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((campaign) => {
            const progress =
              campaign.stats.total > 0
                ? Math.round(((campaign.stats.total - campaign.stats.remaining) / campaign.stats.total) * 100)
                : 0;
            return (
              <button
                key={campaign.id}
                onClick={() => navigate(`/sales/leads?campaignId=${campaign.id}`)}
                className="btn-interactive rounded-xl border border-separator bg-surface p-4 text-left shadow-surface hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">{campaign.name}</h3>
                      {campaign.label ? (
                        <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                          {campaign.label}
                        </span>
                      ) : null}
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_TONE[campaign.status] || STATUS_TONE.DRAFT}`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted">{campaign.description}</p>
                    ) : null}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-default/30 px-2 py-2">
                    <p className="text-sm font-black text-foreground">{campaign.stats.total}</p>
                    <p className="text-[10px] text-muted">Assigned</p>
                  </div>
                  <div className="rounded-lg bg-default/30 px-2 py-2">
                    <p className="text-sm font-black text-accent">{campaign.stats.remaining}</p>
                    <p className="text-[10px] text-muted">Open</p>
                  </div>
                  <div className="rounded-lg bg-default/30 px-2 py-2">
                    <p className="text-sm font-black text-success">{campaign.stats.won}</p>
                    <p className="text-[10px] text-muted">Won</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-default">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] text-muted">{progress}% moved past new / open pipeline</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
