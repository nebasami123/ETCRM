import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Calendar,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Mail,
  Phone,
  Search,
  ShieldAlert,
  UserCheck,
  X
} from "lucide-react";
import { useLeadList } from "../hooks/use-lead-list";
import { useLeadDetail } from "../hooks/use-lead-detail";
import { PhaseBadge } from "../../../components/ui/phase-badge";
import { CustomSelect } from "../../../components/ui/custom-select";
import { CustomMultiSelect } from "../../../components/ui/custom-multi-select";
import { ActivityTimeline } from "../../../components/ui/activity-timeline";
import { formatCapital, formatDateTime, phaseLabels } from "../../../lib/utils/format";
import { filterAddisSubcities, isAddisAbabaRegion } from "../../../lib/utils/addis-subcities";
import type { Lead, LeadPhase } from "../../../types";
import { useAuth } from "../../../hooks/use-auth";
import { Pagination } from "../../../components/ui/pagination";

type LeadScope = "mine" | "all";

const phaseTone: Record<LeadPhase, string> = {
  NEW: "bg-accent/10 text-accent",
  CONTACTED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  FOLLOW_UP: "bg-warning/10 text-warning",
  N_A: "bg-muted/20 text-muted",
  CLOSED_WON: "bg-success/10 text-success",
  CLOSED_LOST: "bg-danger/10 text-danger"
};

function displayStage(lead: Pick<Lead, "phase" | "claimedBy">) {
  if (lead.claimedBy && lead.phase === "NEW") return { label: "Claimed", tone: "bg-accent/10 text-accent" };
  return { label: phaseLabels[lead.phase], tone: phaseTone[lead.phase] };
}

function ContactValue({ value, masked, kind }: { value?: string | null; masked: boolean; kind: "phone" | "email" }) {
  if (!value) return <span className="text-muted">—</span>;
  const Icon = kind === "phone" ? Phone : Mail;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${masked ? "blur-[4px] select-none text-muted" : "text-foreground"}`}>
      <Icon className="h-3 w-3 shrink-0" /> <span className="truncate">{value}</span>
    </span>
  );
}

export function LeadModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { user } = useAuth();
  const detail = useLeadDetail(leadId);
  const [copied, setCopied] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState("");
  const lead = detail.lead;

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1200);
  };

  if (detail.isLoading && !lead) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="rounded-xl border border-separator bg-surface px-6 py-4 text-xs text-muted">Loading lead…</div>
      </div>
    );
  }

  if (!lead) return null;

  const isMine = lead.claimedBy?.id === user?.id;
  const isUnclaimed = !lead.claimedBy;
  const masked = lead.contactMasked ?? false;
  const stage = displayStage(lead);
  const stageOptions = (Object.entries(phaseLabels) as Array<[LeadPhase, string]>)
    .filter(([value]) => value !== "CLOSED_WON")
    .map(([value, label]) => ({ value, label: value === "NEW" && lead.claimedBy ? "Claimed" : label }));
  const isMongo = lead.source === "MONGO" || Boolean(lead.isVirtual);
  const fields = [
    ["Business", lead.businessName],
    ["License", lead.licenceNumber],
    ["Source", isMongo ? "Business directory" : "Manually added"],
    ["Region", lead.businessRegion],
    ["Zone", lead.businessZone],
    ["Subcity / Woreda", lead.businessWoreda],
    ["Manager", [lead.managerFName, lead.managerMName, lead.managerLName].filter(Boolean).join(" ")],
    ["TIN", lead.registry?.tin || lead.licenceNumber],
    ["Capital", lead.registry?.capital != null ? formatCapital(lead.registry.capital) : ""],
    ["Score", lead.registry?.value != null ? formatCapital(lead.registry.value) : ""],
    ["Nationality", lead.registry?.nationality || ""]
  ].filter(([, value]) => Boolean(value));

  const submitTransfer = async () => {
    await detail.requestTransfer(transferReason);
    setTransferReason("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Lead details"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-separator bg-surface shadow-overlay animate-in slide-in-from-bottom-4 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-separator bg-default/20 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Lead dossier</p>
            <h2 className="mt-1 truncate text-xl font-black tracking-tight text-foreground">{lead.fullName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {lead.claimedBy && lead.phase === "NEW" ? (
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${stage.tone}`}>{stage.label}</span>
              ) : (
                <PhaseBadge phase={lead.phase} />
              )}
              {lead.claimedBy ? (
                <span className="text-xs text-muted">
                  Claimed by <strong className="text-foreground">{lead.claimedBy.name}</strong>
                </span>
              ) : (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">OPEN TO CLAIM</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-interactive rounded-lg border border-separator p-2 text-muted hover:bg-default hover:text-foreground"
            aria-label="Close lead"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[1.15fr_.85fr]" data-scrollbar="thin">
          <section className="space-y-6 p-5 sm:p-7">
            {isUnclaimed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/5 p-4">
                <div>
                  <p className="text-xs font-bold text-foreground">Ready to work</p>
                  <p className="mt-0.5 text-[11px] text-muted">Claim this lead to unlock the real contact details and manage its activity.</p>
                </div>
                <button
                  onClick={detail.claimLead}
                  className="btn-interactive inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Claim lead
                </button>
              </div>
            ) : !isMine ? (
              <div className="space-y-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
                <div className="flex gap-2 text-xs text-warning">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    This lead is owned by another rep. Phase, schedule, and notes are claimer-only — request ownership to work it.
                  </span>
                </div>
                <label className="block text-[11px] font-bold text-foreground">
                  Transfer reason
                  <textarea
                    value={transferReason}
                    onChange={(event) => setTransferReason(event.target.value)}
                    rows={2}
                    placeholder="Why should ownership move to you?"
                    className="mt-1.5 w-full resize-none rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-foreground"
                  />
                </label>
                <button
                  onClick={submitTransfer}
                  disabled={transferReason.trim().length < 3 || detail.saving}
                  className="btn-interactive rounded-lg bg-warning px-3 py-2 text-xs font-bold text-warning-foreground disabled:opacity-40"
                >
                  {detail.saving ? "Submitting…" : "Request ownership transfer"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-success/25 bg-success/5 p-3 text-xs font-semibold text-success">
                You own this lead and can update its next actions below.
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Contact</h3>
              <div className="mt-3 grid gap-2 rounded-xl border border-separator bg-default/10 p-4 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <ContactValue value={lead.phoneNumber} masked={masked} kind="phone" />
                  {!masked && (
                    <button onClick={() => copy("phone", lead.phoneNumber)} className="text-muted hover:text-foreground">
                      {copied === "phone" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <ContactValue value={lead.email} masked={masked} kind="email" />
                  {!masked && lead.email && (
                    <button onClick={() => copy("email", lead.email!)} className="text-muted hover:text-foreground">
                      {copied === "email" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Business profile</h3>
              {!isMongo ? (
                <p className="mt-3 rounded-xl border border-separator bg-default/10 p-4 text-xs text-muted">
                  Extra business details (capital, TIN, nationality) are only available for leads from the business directory.
                </p>
              ) : null}
              <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 rounded-xl border border-separator p-4 text-xs">
                {fields.length ? (
                  fields.map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">{value}</dd>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-muted">No additional business information was provided.</p>
                )}
              </dl>
            </div>

            <div>
              <ActivityTimeline activities={lead.events ?? []} isLoading={detail.isLoading} onRefresh={detail.refresh} />
            </div>
          </section>

          <aside className="space-y-5 border-t border-separator bg-default/10 p-5 lg:border-l lg:border-t-0 sm:p-7">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Next actions</h3>
              <p className="mt-1 text-[11px] text-muted">Only the claim owner can save phase, schedule, and notes.</p>
            </div>
            <label className="block text-xs font-bold text-foreground">
              Stage
              <CustomSelect
                value={detail.phase}
                onChange={(value) => detail.setPhase(value as LeadPhase)}
                options={stageOptions}
                disabled={!isMine}
                className="mt-2"
                ariaLabel="Lead stage"
              />
            </label>
            <label className="block text-xs font-bold text-foreground">
              Appointment
              <input
                type="datetime-local"
                value={detail.appointmentDate}
                onChange={(event) => detail.setAppointmentDate(event.target.value)}
                disabled={!isMine}
                className="mt-2 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs disabled:opacity-50"
              />
            </label>
            <label className="block text-xs font-bold text-foreground">
              Follow-up
              <input
                type="datetime-local"
                value={detail.followUpDate}
                onChange={(event) => detail.setFollowUpDate(event.target.value)}
                disabled={!isMine}
                className="mt-2 w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs disabled:opacity-50"
              />
            </label>
            <label className="block text-xs font-bold text-foreground">
              Call note
              <textarea
                value={detail.note}
                onChange={(event) => detail.setNote(event.target.value)}
                disabled={!isMine}
                rows={4}
                placeholder="Capture an outcome or next step…"
                className="mt-2 w-full resize-none rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs disabled:opacity-50"
              />
            </label>
            <button
              onClick={detail.saveAllChanges}
              disabled={!isMine || !detail.canSave}
              className="btn-interactive w-full rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {detail.saving ? "Saving…" : "Save lead activity"}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function SalesPipeline({ scope = "all", initialLeadId }: { scope?: LeadScope; initialLeadId?: string | null }) {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId") || "";
  const list = useLeadList(scope, campaignId);
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId ?? null);
  const title = campaignId ? "Campaign leads" : scope === "mine" ? "My leads" : "Lead pool";
  const description = campaignId
    ? "Leads assigned to you for this campaign. Open one to call and update progress."
    : scope === "mine"
      ? "Leads you own. Update stages, set follow-ups, and log calls here."
      : "Browse available leads and claim the ones you want to work.";

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-separator bg-linear-to-r from-surface via-surface to-accent/5 px-5 py-6 sm:px-7">
        <div className="absolute -right-8 -top-12 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Sales workspace</p>
        <h1 className="relative mt-1 text-2xl font-black tracking-tight text-foreground">{title}</h1>
        <p className="relative mt-1 max-w-2xl text-xs leading-relaxed text-muted">{description}</p>
        {campaignId ? (
          <Link to="/sales/campaigns" className="relative mt-2 inline-block text-[11px] font-bold text-accent hover:underline">
            ← Back to campaigns
          </Link>
        ) : null}
      </div>
      <div className="space-y-3 rounded-xl border border-separator bg-surface p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={list.search}
              onChange={(event) => list.setSearch(event.target.value)}
              placeholder="Search name, business, license, or contact"
              className="w-full rounded-lg border border-field-border bg-field-background py-2 pl-9 pr-3 text-xs"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {(["ALL", "NEW", "CONTACTED", "FOLLOW_UP", "N_A", "CLOSED_WON", "CLOSED_LOST"] as const).map((item) => (
              <button
                key={item}
                onClick={() => list.setPhase(item)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold ${
                  list.phase === item ? "bg-foreground text-background" : "bg-default/50 text-muted hover:text-foreground"
                }`}
              >
                {item === "ALL" ? "All stages" : phaseLabels[item]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <CustomSelect
            value={list.region || ""}
            onChange={(val) => {
              list.setRegion(val);
              if (!isAddisAbabaRegion(val)) list.setSubcity("");
            }}
            options={[
              { value: "", label: "All regions" },
              ...list.locationOptions.regions.map((item) => ({ value: item, label: item }))
            ]}
            placeholder="Region"
            loading={list.isFilterOptionsLoading}
            ariaLabel="Filter by region"
          />
          <CustomSelect
            value={list.subcity || ""}
            onChange={list.setSubcity}
            disabled={!isAddisAbabaRegion(list.region)}
            options={[
              {
                value: "",
                label: isAddisAbabaRegion(list.region) ? "All Addis subcities" : "Select Addis Ababa region first"
              },
              ...(isAddisAbabaRegion(list.region)
                ? filterAddisSubcities(list.locationOptions.subcities).map((item) => ({ value: item, label: item }))
                : [])
            ]}
            placeholder="Subcity"
            loading={list.isFilterOptionsLoading}
            ariaLabel="Filter by subcity"
          />
          <CustomMultiSelect
            value={list.sector || []}
            onChange={list.setSector}
            options={(list.locationOptions.sectors || []).map((item) => ({ value: item, label: item }))}
            placeholder="Sector"
            emptyLabel="All sectors"
            loading={list.isFilterOptionsLoading}
            ariaLabel="Filter by sector"
          />
          <CustomSelect
            value={list.source}
            onChange={(val) => list.setSource(val as "ALL" | "LOCAL" | "MONGO")}
            options={[
              { value: "ALL", label: "All sources" },
              { value: "LOCAL", label: "Manually added" },
              { value: "MONGO", label: "Business registry" }
            ]}
            placeholder="Source"
            ariaLabel="Filter by source"
          />
        </div>
        {list.hasActiveFilters ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={list.clearFilters}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-separator bg-surface">
        <div className="hidden grid-cols-[minmax(180px,1.5fr)_minmax(150px,1fr)_130px_150px_36px] gap-4 border-b border-separator bg-default/15 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted md:grid">
          <span>Lead</span>
          <span>Business</span>
          <span>Stage</span>
          <span>Next action</span>
          <span />
        </div>
        {list.isLoading ? (
          <div className="p-12 text-center text-xs text-muted">Loading leads…</div>
        ) : list.leads.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted">No leads match this view.</div>
        ) : (
          list.leads.map((lead: Lead) => {
            const stage = displayStage(lead);
            const overdue =
              lead.nextFollowUpAt &&
              new Date(lead.nextFollowUpAt).getTime() < Date.now() &&
              lead.phase !== "CLOSED_WON" &&
              lead.phase !== "CLOSED_LOST" &&
              lead.phase !== "N_A";
            return (
              <button
                key={lead.id}
                onClick={() => setSelectedId(lead.id)}
                className="group grid w-full grid-cols-[1fr_auto] gap-3 border-b border-separator px-5 py-4 text-left transition-colors last:border-0 hover:bg-accent/4 md:grid-cols-[minmax(180px,1.5fr)_minmax(150px,1fr)_130px_150px_36px] md:items-center md:gap-4"
              >
                <span className="min-w-0">
                  <strong className="block truncate text-xs text-foreground">{lead.fullName}</strong>
                  <span className={`mt-1 block text-[10px] ${lead.contactMasked ? "blur-[4px] select-none" : "text-muted"}`}>
                    {lead.phoneNumber}
                  </span>
                </span>
                <span className="hidden min-w-0 md:block">
                  <span className="block truncate text-xs text-muted">{lead.businessName || "—"}</span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    {lead.source === "MONGO" ? "Registry" : "Local"}
                    {lead.businessRegion ? ` · ${lead.businessRegion}` : ""}
                    {lead.businessWoreda ? ` · ${lead.businessWoreda}` : ""}
                  </span>
                </span>
                <span className={`hidden w-fit rounded-full px-2 py-1 text-[10px] font-bold md:block ${stage.tone}`}>{stage.label}</span>
                <span className={`hidden items-center gap-1.5 text-[11px] md:flex ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
                  {lead.appointmentDate ? <Calendar className="h-3.5 w-3.5 text-success" /> : <Clock3 className="h-3.5 w-3.5 text-warning" />}
                  {overdue ? "Overdue · " : ""}
                  {formatDateTime(lead.appointmentDate || lead.nextFollowUpAt)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </button>
            );
          })
        )}
        <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      </div>
      {selectedId && <LeadModal leadId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

export default SalesPipeline;
