import { useState } from "react";
import { Clock, FileText, UserCheck, ShieldAlert, ArrowLeft, Copy, Check, Milestone, Calendar, ArrowLeftRight, Save } from "lucide-react";
import { useLeadList } from "../hooks/use-lead-list";
import { useLeadDetail } from "../hooks/use-lead-detail";
import { useAuth } from "../../../hooks/use-auth";
import { PhaseBadge } from "../../../components/ui/phase-badge";
import { CustomSelect } from "../../../components/ui/custom-select";
import { formatDateTime, phaseLabels } from "../../../lib/utils/format";
import type { LeadPhase, Activity } from "../../../types";

const getEventIcon = (type: string) => {
  switch (type) {
    case "CALL_NOTE":
      return <FileText className="h-3.5 w-3.5 text-accent" />;
    case "PHASE_CHANGED":
      return <Milestone className="h-3.5 w-3.5 text-blue-500" />;
    case "APPOINTMENT_SET":
      return <Calendar className="h-3.5 w-3.5 text-success" />;
    case "FOLLOW_UP_SET":
      return <Clock className="h-3.5 w-3.5 text-warning" />;
    case "LEAD_CREATED":
      return <UserCheck className="h-3.5 w-3.5 text-accent" />;
    case "LEAD_CLAIMED":
      return <UserCheck className="h-3.5 w-3.5 text-success" />;
    case "CLAIM_TRANSFER_REQUESTED":
    case "CLAIM_TRANSFER_APPROVED":
    case "CLAIM_TRANSFER_REJECTED":
      return <ArrowLeftRight className="h-3.5 w-3.5 text-purple-500" />;
    default:
      return <FileText className="h-3.5 w-3.5 text-muted" />;
  }
};

interface ActivityMetadata {
  value?: string;
  imported?: number;
}

const getEventDetailText = (ev: Activity) => {
  const meta = ev.metadata as ActivityMetadata | null | undefined;
  switch (ev.type) {
    case "CALL_NOTE":
      return "Call Logged";
    case "PHASE_CHANGED": {
      const fromLabel = ev.fromPhase ? phaseLabels[ev.fromPhase as LeadPhase] || ev.fromPhase : "Unknown";
      const toLabel = ev.toPhase ? phaseLabels[ev.toPhase as LeadPhase] || ev.toPhase : "Unknown";
      return `Stage updated from ${fromLabel} to ${toLabel}`;
    }
    case "APPOINTMENT_SET": {
      const apptVal = meta?.value;
      return `Appointment set for ${apptVal ? formatDateTime(apptVal) : "None"}`;
    }
    case "FOLLOW_UP_SET": {
      const followVal = meta?.value;
      return `Follow-up target set for ${followVal ? formatDateTime(followVal) : "None"}`;
    }
    case "LEAD_CREATED":
      return "Lead created in system";
    case "LEAD_IMPORTED": {
      const count = meta?.imported || 0;
      return `Lead database imported (${count} records)`;
    }
    case "LEAD_CLAIMED":
      return "Lead claimed by agent";
    case "CLAIM_TRANSFER_REQUESTED":
      return "Claim transfer requested";
    case "CLAIM_TRANSFER_APPROVED":
      return "Claim transfer approved";
    case "CLAIM_TRANSFER_REJECTED":
      return "Claim transfer rejected";
    default:
      return "Workflow action";
  }
};


export function SalesPipeline() {
  const { user } = useAuth();
  const listHook = useLeadList();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  // Right panel detail hooks
  const detailHook = useLeadDetail(selectedLeadId);

  // Toggle detail panel view on mobile
  const [mobileDetailVisible, setMobileDetailVisible] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const selectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setMobileDetailVisible(true);
  };

  const handleClaimTransfer = () => {
    const reason = window.prompt("Explain to the Admin why ownership of this lead should be transferred to you:");
    if (reason && reason.trim()) {
      detailHook.requestTransfer(reason);
    }
  };

  const isClaimedByOthers = detailHook.lead?.claimedBy && detailHook.lead.claimedBy.id !== user?.id;
  const isClaimedByMe = detailHook.lead?.claimedBy && detailHook.lead.claimedBy.id === user?.id;

  const handleCopy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 1500);
  };

  const extraFields = detailHook.lead
    ? [
        ["Phone Number", detailHook.lead.phoneNumber],
        ["Email Address", detailHook.lead.email],
        ["Business Name", detailHook.lead.businessName],
        ["Amharic Name", detailHook.lead.businessNameAmharic],
        ["Legal Status", detailHook.lead.legalStatusNameEng],
        ["License Number", detailHook.lead.licenceNumber],
        ["Registered Date", detailHook.lead.dateRegistered],
        ["Region", detailHook.lead.businessRegion],
        ["Zone", detailHook.lead.businessZone],
        ["Woreda", detailHook.lead.businessWoreda],
        ["Kebele", detailHook.lead.businessKebele],
        ["Manager", [detailHook.lead.managerFName, detailHook.lead.managerMName, detailHook.lead.managerLName].filter(Boolean).join(" ")],
        ["English Description", detailHook.lead.englishDescription || detailHook.lead.subGroupEn]
      ].filter((f): f is [string, string] => Boolean(f[1] && f[1] !== "None"))
    : [];

  return (
    <div className="grid h-[calc(100vh-140px)] gap-6 lg:grid-cols-[360px_1fr] overflow-hidden">
      
      {/* Left List Pane */}
      <div className={`flex flex-col h-full bg-surface border border-separator rounded-xl overflow-hidden shadow-surface ${mobileDetailVisible ? "hidden lg:flex" : "flex"}`}>
        {/* Search */}
        <div className="p-4 border-b border-separator bg-default/15 space-y-3">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">My Leads Queue</h3>
          <input
            type="text"
            placeholder="Filter by name, phone, license..."
            value={listHook.search}
            onChange={(e) => listHook.setSearch(e.target.value)}
            className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
          />
        </div>

        {/* Lead Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-separator p-2" data-scrollbar="thin">
          {listHook.isLoading ? (
            <div className="text-center py-8 text-xs text-muted">Loading queue...</div>
          ) : listHook.leads.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted">No leads matching filters.</div>
          ) : (
            listHook.leads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => selectLead(lead.id)}
                className={`w-full text-left rounded-lg p-3 transition-all duration-300 ease-out-smooth cursor-pointer flex flex-col gap-1.5 focus:outline-none ${
                  selectedLeadId === lead.id
                    ? "bg-accent/10 border border-accent/20"
                    : "hover:bg-default/40 border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <span className="text-xs font-bold text-foreground truncate pr-2">
                    {lead.fullName}
                  </span>
                  <PhaseBadge phase={lead.phase} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span className="font-mono">{lead.phoneNumber}</span>
                  {lead.nextFollowUpAt && (
                    <span className="flex items-center gap-1 text-warning font-semibold">
                      <Clock className="h-3 w-3" />
                      Follow-up
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Detail Pane */}
      <div className={`flex flex-col h-full bg-surface border border-separator rounded-xl overflow-hidden shadow-surface ${!mobileDetailVisible ? "hidden lg:flex" : "flex"}`}>
        {selectedLeadId && detailHook.lead ? (
          <>
            {/* Header / Nav Top */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-separator shrink-0 bg-default/15 justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileDetailVisible(false)}
                  className="btn-interactive lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground"
                  aria-label="Back to queue"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h3 className="text-sm font-bold text-foreground">{detailHook.lead.fullName}</h3>
                  <p className="text-[10px] text-muted font-mono">{detailHook.lead.phoneNumber}</p>
                </div>
              </div>
              <PhaseBadge phase={detailHook.lead.phase} />
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6" data-scrollbar="thin">
              {/* Claim Conflict Banners */}
              {!detailHook.lead.claimedBy ? (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="text-xs text-foreground/80 text-center sm:text-left">
                    This lead is currently <strong className="font-bold">UNCLAIMED</strong>. Sales reps can claim ownership.
                  </div>
                  <button
                    onClick={detailHook.claimLead}
                    className="btn-interactive shrink-0 px-4 py-1.5 text-xs font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90"
                  >
                    Claim Lead
                  </button>
                </div>
              ) : isClaimedByOthers ? (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div className="text-xs text-warning text-center sm:text-left flex items-start gap-2">
                    <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-warning" />
                    <span>
                      Claimed by <strong className="font-bold">{detailHook.lead.claimedBy.name}</strong>. You can request a transfer.
                    </span>
                  </div>
                  <button
                    onClick={handleClaimTransfer}
                    className="btn-interactive shrink-0 px-4 py-1.5 text-xs font-bold border border-warning/30 text-warning hover:bg-warning/10 rounded-lg"
                  >
                    Request Transfer
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-xs text-success font-semibold animate-in fade-in duration-200">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span>You have claimed ownership of this lead</span>
                </div>
              )}

              {/* Unified Actions Form Container */}
              <div 
                className="premium-card group rounded-xl border border-separator bg-linear-to-br from-surface to-surface/95 p-5 shadow-surface hover:shadow-lg transition-all duration-300 ease-out-smooth relative overflow-hidden"
                style={{ "--card-glow": "var(--accent)" } as React.CSSProperties}
              >
                {/* Glow Background inside element */}
                <div className="absolute -right-10 -bottom-10 w-24 h-24 rounded-full bg-accent/3 opacity-0 group-hover:opacity-100 blur-xl pointer-events-none transition-all duration-500 ease-out-smooth group-hover:scale-125" />

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Stage Editor */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Milestone className="h-3.5 w-3.5 text-accent shrink-0" />
                      Update Phase Stage
                    </h4>
                    <CustomSelect
                      value={detailHook.phase}
                      onChange={(val) => detailHook.setPhase(val as LeadPhase)}
                      disabled={!isClaimedByMe || detailHook.phase === "CLOSED_WON"}
                      options={[
                        { value: "NEW", label: "New" },
                        { value: "CONTACTED", label: "Contacted" },
                        { value: "FOLLOW_UP", label: "Follow-Up" },
                        { value: "CLOSED_LOST", label: "Closed-Lost" },
                        ...(detailHook.phase === "CLOSED_WON" ? [{ value: "CLOSED_WON", label: "Closed-Won (Admin Lock)" }] : [])
                      ]}
                      className="w-full"
                    />
                    {detailHook.phase === "CLOSED_WON" && (
                      <p className="text-[10px] text-muted italic">Only admins can select conversion credits to close leads as WON.</p>
                    )}
                  </div>

                  {/* Appointment setting */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Calendar className="h-3.5 w-3.5 text-accent shrink-0" />
                      Schedule Appointment
                    </h4>
                    <input
                      type="datetime-local"
                      value={detailHook.appointmentDate}
                      onChange={(e) => detailHook.setAppointmentDate(e.target.value)}
                      disabled={!isClaimedByMe || detailHook.saving}
                      className="w-full rounded-lg border border-field-border bg-field-background px-3 py-1.5 text-xs text-field-foreground focus:border-accent focus:outline-none disabled:opacity-50 font-mono"
                    />
                  </div>

                  {/* Follow up setting */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <Clock className="h-3.5 w-3.5 text-accent shrink-0" />
                      Next Follow-Up Target
                    </h4>
                    <input
                      type="datetime-local"
                      value={detailHook.followUpDate}
                      onChange={(e) => detailHook.setFollowUpDate(e.target.value)}
                      disabled={!isClaimedByMe || detailHook.saving}
                      className="w-full rounded-lg border border-field-border bg-field-background px-3 py-1.5 text-xs text-field-foreground focus:border-accent focus:outline-none disabled:opacity-50 font-mono"
                    />
                  </div>

                  {/* Call Notes Textarea */}
                  <div className="space-y-3 md:col-span-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <FileText className="h-3.5 w-3.5 text-accent shrink-0" />
                      Log Call Notes
                    </h4>
                    <textarea
                      rows={4}
                      value={detailHook.note}
                      onChange={(e) => detailHook.setNote(e.target.value)}
                      disabled={!isClaimedByMe || detailHook.saving}
                      placeholder="Summarize discussion outcome, follow-up dates, or objections..."
                      className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none resize-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Combined Save Button */}
                <div className="flex justify-end mt-4 border-t border-separator pt-4">
                  <button
                    disabled={!isClaimedByMe || !detailHook.canSave || detailHook.saving}
                    onClick={detailHook.saveAllChanges}
                    className="btn-interactive flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg shadow-md hover:opacity-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {detailHook.saving ? "Saving Changes..." : "Save All Changes"}
                  </button>
                </div>
              </div>

              {/* Extra business details (collapsible structure) */}
              {extraFields.length > 0 && (
                <div className="border-t border-separator pt-5">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                    Lead Metadata Parameters
                  </h4>
                  <div className="grid gap-2 border border-separator rounded-xl p-4 bg-default/10 text-xs leading-relaxed">
                    {extraFields.map(([lbl, val]) => {
                      const isPhone = lbl === "Phone Number";
                      const isEmail = lbl === "Email Address";
                      const isCopied = copiedLabel === lbl;

                      return (
                        <div key={lbl} className="grid grid-cols-3 gap-2 py-1 items-center">
                          <span className="text-muted font-bold">{lbl}</span>
                          <div className="col-span-2 flex items-center justify-between gap-2 overflow-hidden">
                            {isPhone ? (
                              <a
                                href={`tel:${val}`}
                                className="text-accent hover:underline font-semibold truncate"
                              >
                                {val}
                              </a>
                            ) : isEmail ? (
                              <a
                                href={`mailto:${val}`}
                                className="text-accent hover:underline font-semibold truncate"
                              >
                                {val}
                              </a>
                            ) : (
                              <span className="text-foreground font-semibold truncate">
                                {lbl.includes("Date") ? formatDateTime(val) : val}
                              </span>
                            )}
                            {(isPhone || isEmail) && (
                              <button
                                type="button"
                                onClick={() => handleCopy(lbl, val)}
                                className="btn-interactive p-1 text-muted hover:text-foreground hover:bg-default/20 rounded-md shrink-0 transition-colors"
                                title={`Copy ${lbl}`}
                              >
                                {isCopied ? (
                                  <Check className="h-3.5 w-3.5 text-success animate-in fade-in zoom-in duration-100" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline History */}
              <div className="border-t border-separator pt-5">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4">
                  Lead Workflow Timeline History
                </h4>
                <div className="relative border-l border-separator pl-4 ml-3 space-y-4 py-1">
                  {(detailHook.lead.events || []).map((ev) => (
                    <div key={ev.id} className="relative text-xs leading-normal">
                      <div className="absolute -left-7.5 top-0.5 h-7 w-7 flex items-center justify-center rounded-full bg-overlay border border-separator">
                        {getEventIcon(ev.type)}
                      </div>
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold text-foreground">
                          {getEventDetailText(ev)}
                        </span>
                        <span className="text-[10px] text-muted font-mono shrink-0">
                          {formatDateTime(ev.createdAt)}
                        </span>
                      </div>
                      {ev.actor && <p className="text-[10px] text-muted mt-0.5">by {ev.actor.name}</p>}
                      {ev.note && (
                        <p className="mt-1 text-muted border border-separator rounded-lg bg-default/20 p-2 italic">
                          &ldquo;{ev.note}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <h3 className="text-sm font-bold text-foreground">Lead Details Panel</h3>
            <p className="text-xs text-muted max-w-60 mt-1 leading-relaxed">
              Select a contact from the queue to start updating status phase and logging calls.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
export default SalesPipeline;
