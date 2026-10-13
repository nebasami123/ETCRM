import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CircleHelp, LoaderCircle, Pencil, Plus, Search, Send, Trash2, X } from "lucide-react";
import { useAuth } from "../../../hooks/use-auth";
import { useToast } from "../../../hooks/use-toast";
import { FormField } from "../../../components/forms/form-field";
import { LeadForm } from "../../../components/forms/lead-form";
import { CustomSelect } from "../../../components/ui/custom-select";
import { leadSourceOptions, normalizeLeadSource } from "../../../lib/constants/lead-sources";
import { leadFormSchema } from "../../../lib/validations/leads";
import { salesApi } from "../api";
import { getErrorMessage, formatDate, toDateTimeLocalValue } from "../../../lib/utils/format";
import type { Lead, LeadFormData, SalesPipelineStage } from "../../../types";
import { salesPipelineStages as pipelineStages } from "@etcrm/contracts";

const fields = "w-full rounded-lg border border-field-border bg-field-background px-3 py-2.5 text-sm text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";

function pipelineStageForLead(lead: Lead): SalesPipelineStage {
  if (lead.pipelineStage) return lead.pipelineStage;
  if (lead.phase === "NEW") return "Lead";
  if (lead.phase === "CONTACTED") return "Contacted";
  if (lead.phase === "CLOSED_WON") return "Closed Won";
  if (lead.phase === "CLOSED_LOST") return "Closed Lost";
  return "Meeting Booked";
}

type Mode = "new" | "update";

interface LeadLogDraft {
  key: string;
  mode: Mode;
  leadId?: string;
  fullName: string;
  phoneNumber: string;
  pipelineStage: SalesPipelineStage;
  leadSource: string;
  leadSourceDetail: string;
  note: string;
  error?: string;
  newLead?: {
    fullName: string;
    phoneNumber: string;
    email: string;
    leadSource: string;
    leadSourceDetail: string;
    nextFollowUpAt: string | null;
  };
}

export function SalesLeadLog() {
  const { user } = useAuth();
  const { success, danger } = useToast();
  const [mode, setMode] = useState<Mode>("new");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadQuery, setLeadQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<LeadLogDraft[]>([]);
  const [mainBlocker, setMainBlocker] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("251");
  const [email, setEmail] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [followUpDate, setFollowUpDate] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [leadSourceDetail, setLeadSourceDetail] = useState("");
  const [pipelineStage, setPipelineStage] = useState<SalesPipelineStage>("Lead");
  const [note, setNote] = useState("");
  const availableLeadSourceOptions = user?.salesType === "EXTERNAL"
    ? leadSourceOptions.filter((option) => option.value !== "Internal lead pool")
    : leadSourceOptions;

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const matchingLeads = useMemo(() => {
    const query = leadQuery.trim().toLocaleLowerCase();
    if (!query) return leads.slice(0, 6);
    return leads.filter((lead) => `${lead.fullName} ${lead.phoneNumber}`.toLocaleLowerCase().includes(query)).slice(0, 6);
  }, [leadQuery, leads]);
  const visibleOwnedLeads = useMemo(() => {
    const query = leadQuery.trim().toLocaleLowerCase();
    if (!query) return leads;
    return leads.filter((lead) => `${lead.fullName} ${lead.phoneNumber}`.toLocaleLowerCase().includes(query));
  }, [leadQuery, leads]);

  async function loadLeads() {
    try {
      setLoadingLeads(true);
      const firstPage = await salesApi.getLeads({ scope: "mine", search: "", phase: "ALL", page: 1, pageSize: 100 });
      const allLeads = [...firstPage.leads];
      for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
        const result = await salesApi.getLeads({ scope: "mine", search: "", phase: "ALL", page, pageSize: 100 });
        allLeads.push(...result.leads);
      }
      setLeads(allLeads);
    } catch (error) {
      danger(getErrorMessage(error, "Could not load your leads"));
    } finally {
      setLoadingLeads(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    // The page owns this one initial fetch; toast callbacks do not affect the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setNote("");
    if (nextMode === "new") {
      setSelectedLeadId("");
      setPipelineStage("Lead");
      setLeadSource("");
      setLeadSourceDetail("");
    }
  }

  function selectLead(lead: Lead) {
    setSelectedLeadId(lead.id);
    setEditingDetails(false);
    setLeadQuery("");
    setPipelineStage(pipelineStageForLead(lead));
    const normalizedSource = normalizeLeadSource(lead.leadSource);
    setLeadSource(normalizedSource.source);
    setLeadSourceDetail(normalizedSource.source === "Other" ? (lead.leadSourceDetail || normalizedSource.detail) : "");
  }

  async function saveLeadDetails(values: LeadFormData) {
    if (!selectedLead || savingDetails) return;
    setSavingDetails(true);
    try {
      const updated = await salesApi.updateLead(selectedLead.id, {
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        leadSource: values.leadSource,
        leadSourceDetail: values.leadSourceDetail,
        appointmentDate: values.appointmentDate
      });
      setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
      setEditingDetails(false);
      success("Lead details saved. Your edits were added to the activity history.");
    } catch (error) {
      danger(getErrorMessage(error, "Could not save lead details"));
      throw error;
    } finally {
      setSavingDetails(false);
    }
  }

  function addDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) {
      setFormErrors((current) => ({ ...current, note: "Notes are required" }));
      return;
    }
    if (mode === "update" && !selectedLead) return;
    if (mode === "new") {
      if (!countryCode || !phoneNumber) {
        setFormErrors((current) => ({ ...current, phoneNumber: "Country code and phone number are required" }));
        return;
      }
      const validation = leadFormSchema.safeParse({
        fullName,
        phoneNumber: `+${countryCode}${phoneNumber}`,
        email,
        leadSource,
        leadSourceDetail,
        nextFollowUpAt: followUpDate || null
      });
      if (!validation.success) {
        const nextErrors: Record<string, string> = {};
        validation.error.issues.forEach((issue) => {
          const key = issue.path[0];
          if (key) nextErrors[String(key)] = issue.message;
        });
        setFormErrors(nextErrors);
        return;
      }
    }
    setFormErrors({});
    const draft: LeadLogDraft = {
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      mode,
      leadId: selectedLead?.id,
      fullName: mode === "new" ? fullName.trim() : selectedLead!.fullName,
      phoneNumber: mode === "new" ? `+${countryCode}${phoneNumber}` : selectedLead!.phoneNumber,
      pipelineStage,
      leadSource: leadSource.trim(),
      leadSourceDetail: leadSource === "Other" ? leadSourceDetail.trim() : "",
      note: note.trim(),
      newLead: mode === "new" ? {
        fullName: fullName.trim(),
        phoneNumber: `+${countryCode}${phoneNumber}`,
        email: email.trim(),
        leadSource: leadSource.trim(),
        leadSourceDetail: leadSource === "Other" ? leadSourceDetail.trim() : "",
        nextFollowUpAt: followUpDate ? new Date(followUpDate).toISOString() : null
      } : undefined
    };
    setDrafts((current) => [...current, draft]);
    setNote("");
    if (mode === "new") {
      setFullName("");
      setPhoneNumber("");
      setCountryCode("251");
      setEmail("");
      setFormErrors({});
      setFollowUpDate("");
      setLeadSource("");
      setLeadSourceDetail("");
      setPipelineStage("Lead");
    } else {
      setSelectedLeadId("");
      setLeadQuery("");
      setLeadSource("");
      setLeadSourceDetail("");
      setPipelineStage("Lead");
    }
    success("Added to today’s batch. Submit the batch when you’re ready.");
  }

  async function submitBatch() {
    if (!drafts.length || saving) return;
    setSaving(true);
    const completed = new Set<string>();
    const failed = new Map<string, string>();
    const noteForEntry = (entryNote: string) => [entryNote.trim(), mainBlocker.trim() ? `Main blocker: ${mainBlocker.trim()}` : ""].filter(Boolean).join("\n\n");
    try {
      for (const draft of drafts) {
        try {
          if (draft.mode === "new" && draft.newLead) {
            await salesApi.createLead({ ...draft.newLead, pipelineStage: draft.pipelineStage, leadSource: draft.leadSource, leadSourceDetail: draft.leadSourceDetail, note: noteForEntry(draft.note) });
          } else if (draft.leadId) {
            await salesApi.updateLeadLog(draft.leadId, { pipelineStage: draft.pipelineStage, note: noteForEntry(draft.note) });
          }
          completed.add(draft.key);
        } catch (error) {
          failed.set(draft.key, getErrorMessage(error, "Could not save this entry"));
        }
      }
      setDrafts((current) => current.filter((draft) => !completed.has(draft.key)).map((draft) => ({ ...draft, error: failed.get(draft.key) })));
      if (completed.size) success(`Submitted ${completed.size} ${completed.size === 1 ? "entry" : "entries"} to the lead timeline`);
      if (failed.size) danger(`${failed.size} ${failed.size === 1 ? "entry needs" : "entries need"} attention. Review the message below each row and retry.`);
      if (!failed.size) setMainBlocker("");
      if (completed.size) await loadLeads();
    } finally {
      setSaving(false);
    }
  }

  const stageIsAdminOwned = pipelineStage === "Closed Won" && mode === "new";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-separator pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lead log</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Add a new customer or record today’s progress on a lead you own.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Check className="h-3.5 w-3.5" />
          </span>
          <span>{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
          {user?.email ? <span className="text-separator">·</span> : null}
          {user?.email ? <span>{user.email}</span> : <span>{user?.name}</span>}
        </div>
      </header>

      <section className="grid gap-3 border-b border-separator pb-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] sm:items-end">
        <FormField label="Main blocker (optional)">
          <input className={fields} value={mainBlocker} onChange={(event) => setMainBlocker(event.target.value)} placeholder="What is slowing the team down today?" />
        </FormField>
        <p className="pb-2 text-[11px] leading-relaxed text-muted">This note is included with each entry in today’s submitted batch.</p>
      </section>

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-lg border border-separator bg-surface p-1" role="tablist" aria-label="Lead log action">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "new"}
                onClick={() => changeMode("new")}
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${mode === "new" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                <ArrowUpRight className="h-3.5 w-3.5" /> New customer
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "update"}
                onClick={() => changeMode("update")}
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${mode === "update" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                <ArrowDownLeft className="h-3.5 w-3.5" /> Update existing
              </button>
            </div>
            <span className="text-[11px] text-muted">Add rows here, then submit once when the batch is ready.</span>
          </div>

          {mode === "update" ? (
            <div className="mb-6">
              <label className={labelClass} htmlFor="lead-search">Existing customer <span className="text-danger">*</span></label>
              {selectedLead ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{selectedLead.fullName}</p>
                    <p className="mt-0.5 text-xs text-muted">{selectedLead.phoneNumber}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedLeadId(""); setLeadQuery(""); setEditingDetails(false); }} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/10">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
                  <input id="lead-search" className={`${fields} pl-9`} value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)} placeholder={loadingLeads ? "Loading your leads…" : "Search by customer, phone, or business"} disabled={loadingLeads} autoComplete="off" />
                  {leadQuery.trim() ? (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-separator bg-overlay shadow-overlay" role="listbox" aria-label="Matching leads">
                      {matchingLeads.length ? matchingLeads.map((lead) => (
                        <button key={lead.id} type="button" role="option" aria-selected="false" onClick={() => selectLead(lead)} className="flex w-full items-center justify-between gap-3 border-b border-separator px-3 py-2.5 text-left last:border-0 hover:bg-default">
                          <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{lead.fullName}</span><span className="mt-0.5 block truncate text-[11px] text-muted">{lead.phoneNumber}</span></span>
                          <span className="shrink-0 rounded-full bg-default px-2 py-1 text-[10px] text-muted">{pipelineStageForLead(lead)}</span>
                        </button>
                      )) : <p className="px-3 py-3 text-xs text-muted">No matching leads in your queue.</p>}
                    </div>
                  ) : null}
                  {!loadingLeads && leads.length === 0 ? <p className="mt-2 text-xs text-muted">You don’t have any claimed leads yet. Claim a lead from My Leads or add a new customer.</p> : null}
                </div>
              )}
            </div>
          ) : null}

          {mode === "update" ? (
            <section className="mb-6 overflow-hidden rounded-xl border border-separator bg-surface" aria-label="Your leads">
              <div className="flex items-center justify-between border-b border-separator px-4 py-3">
                <div>
                  <h2 className="text-xs font-bold text-foreground">Your leads</h2>
                  <p className="mt-0.5 text-[10px] text-muted">Select a lead to add a pipeline update.</p>
                </div>
                <span className="rounded-full bg-default px-2 py-1 text-[10px] text-muted">{visibleOwnedLeads.length}</span>
              </div>
              <div className="max-h-80 overflow-auto">
                {loadingLeads ? <p className="p-5 text-center text-xs text-muted">Loading your leads…</p> : visibleOwnedLeads.length ? (
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="sticky top-0 bg-default text-[10px] uppercase tracking-wide text-muted">
                      <tr><th className="px-4 py-2.5 font-semibold">Lead</th><th className="px-4 py-2.5 font-semibold">Phone</th><th className="px-4 py-2.5 font-semibold">Stage</th><th className="px-4 py-2.5 font-semibold">Follow-up</th><th className="px-4 py-2.5" /></tr>
                    </thead>
                    <tbody>
                      {visibleOwnedLeads.map((lead) => (
                        <tr key={lead.id} className={`border-t border-separator ${selectedLeadId === lead.id ? "bg-accent/5" : "hover:bg-default/40"}`}>
                          <td className="px-4 py-3"><button type="button" onClick={() => selectLead(lead)} className="text-left font-semibold text-foreground hover:text-accent">{lead.fullName}</button></td>
                          <td className="px-4 py-3 text-muted">{lead.phoneNumber}</td>
                          <td className="px-4 py-3"><span className="whitespace-nowrap rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">{pipelineStageForLead(lead)}</span></td>
                          <td className="px-4 py-3 text-muted">{lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "—"}</td>
                          <td className="px-4 py-3 text-right"><button type="button" onClick={() => selectLead(lead)} className="text-[10px] font-semibold text-accent hover:underline">Update</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="p-5 text-center text-xs text-muted">{leadQuery.trim() ? "No leads match your search." : "No leads are assigned to you yet."}</p>}
              </div>
            </section>
          ) : null}

          {mode === "update" && selectedLead ? (
            <div className="mb-6">
              {selectedLead.kind === "LOCAL" ? (
                <div>
                  <button type="button" onClick={() => setEditingDetails((value) => !value)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-separator px-3 text-xs font-semibold text-foreground hover:bg-default">
                    {editingDetails ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    {editingDetails ? "Cancel detail edit" : "Edit customer details"}
                  </button>
                  <p className="mt-1.5 text-[10px] text-muted">Saved edits are timestamped and retained in the activity history.</p>
                </div>
              ) : <p className="rounded-lg bg-default/60 px-3 py-2 text-[11px] text-muted">This contact comes from the business registry. Its profile is managed in the source directory.</p>}
              {editingDetails && selectedLead.kind === "LOCAL" ? (
                <div className="mt-3">
                  <LeadForm
                    key={selectedLead.id}
                    title="Edit submitted lead details"
                    initialValues={{
                      fullName: selectedLead.fullName,
                      phoneNumber: selectedLead.phoneNumber,
                      email: selectedLead.email ?? "",
                      leadSource: selectedLead.leadSource ?? "",
                      leadSourceDetail: selectedLead.leadSourceDetail,
                      appointmentDate: toDateTimeLocalValue(selectedLead.appointmentDate)
                    }}
                    onSubmit={saveLeadDetails}
                    isLoading={savingDetails}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <form noValidate onSubmit={addDraft} className="space-y-6">
            {mode === "new" ? (
              <section aria-labelledby="customer-details-heading" className="space-y-4">
                <div className="flex items-center justify-between border-b border-separator pb-2">
                  <h2 id="customer-details-heading" className="text-sm font-bold text-foreground">Customer details</h2>
                  <span className="text-[10px] text-muted"><span className="text-danger">*</span> Required</span>
                </div>
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <FormField label="Full name" required error={formErrors.fullName}>
                    <input className={fields} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Hana Bekele" required autoComplete="name" />
                  </FormField>
                  <FormField label="Phone number" required error={formErrors.phoneNumber}>
                    <div className="flex gap-2">
                      <div className="flex w-24 shrink-0 items-center rounded-lg border border-field-border bg-field-background px-3 focus-within:border-accent">
                        <span className="text-sm text-muted">+</span>
                        <input aria-label="Country calling code" className="min-w-0 w-full bg-transparent py-2.5 text-sm text-field-foreground outline-none" value={countryCode} onChange={(event) => setCountryCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" pattern="[0-9]*" autoComplete="tel-country-code" maxLength={4} required />
                      </div>
                      <input aria-label="Phone number" className={`${fields} min-w-0 flex-1`} type="tel" inputMode="numeric" pattern="[0-9]*" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="911234567" required autoComplete="tel-national" />
                    </div>
                  </FormField>
                  <FormField label="Email address" error={formErrors.email}>
                    <input className={fields} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
                  </FormField>
                  <FormField label="Follow-up date">
                    <input className={fields} type="datetime-local" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
                  </FormField>
                </div>
              </section>
            ) : null}

            {(mode === "new" || selectedLead) ? (
              <section aria-labelledby="pipeline-heading" className="space-y-4">
                <div className="border-b border-separator pb-2">
                  <h2 id="pipeline-heading" className="text-sm font-bold text-foreground">{mode === "new" ? "Customer & pipeline" : "Progress update"}</h2>
                  <p className="mt-1 text-[11px] text-muted">{mode === "new" ? "Choose the customer’s latest stage from the team pipeline." : "Add a progress entry here. Edit customer details separately; saved changes are tracked in the activity history."}</p>
                </div>
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  {mode === "new" ? <FormField label="Lead source">
                    <CustomSelect
                      value={leadSource}
                      onChange={(value) => {
                        setLeadSource(value);
                        if (value !== "Other") setLeadSourceDetail("");
                      }}
                      options={availableLeadSourceOptions}
                      placeholder="Select lead source"
                      ariaLabel="Lead source"
                      searchable
                    />
                  </FormField>
                  : <FormField label="Original lead source">
                    <div className={`${fields} min-h-10 text-muted`}>{selectedLead?.leadSource || "Not recorded"}{selectedLead?.leadSourceDetail ? ` · ${selectedLead.leadSourceDetail}` : ""}</div>
                  </FormField>}
                  {mode === "new" && leadSource === "Other" ? (
                    <FormField label="Please specify">
                      <input className={fields} value={leadSourceDetail} onChange={(event) => setLeadSourceDetail(event.target.value)} placeholder="Describe where this lead came from" maxLength={200} />
                    </FormField>
                  ) : null}
                  <FormField label="Latest stage" required>
                    <CustomSelect
                      value={pipelineStage}
                      onChange={(value) => setPipelineStage(value as SalesPipelineStage)}
                      ariaLabel="Latest stage"
                      options={pipelineStages.map((stage) => ({
                        value: stage,
                        label: stage === "Closed Won" ? `${stage} · admin only` : stage,
                        disabled: stage === "Closed Won" && (mode === "new" || selectedLead?.phase !== "CLOSED_WON")
                      }))}
                    />
                    {stageIsAdminOwned ? <p className="mt-1.5 text-[11px] text-muted">An admin records a win and assigns conversion credit.</p> : null}
                  </FormField>
                  <FormField label="Notes" required className="sm:col-span-2" error={formErrors.note}>
                    <textarea className={`${fields} min-h-28 resize-y leading-relaxed`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What happened today? Capture the conversation, customer response, or next step." required minLength={2} maxLength={5000} />
                    <div className="mt-1 flex justify-between gap-3 text-[10px] text-muted"><span>This note is added to the lead’s activity timeline.</span><span>{note.length}/5000</span></div>
                  </FormField>
                </div>
              </section>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-separator pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted">{mode === "new" ? "The new customer will be assigned to you automatically." : "Only leads assigned to you can be updated here."}</p>
              <button type="submit" disabled={saving || !note.trim() || (mode === "update" && !selectedLead) || stageIsAdminOwned} className="btn-interactive inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-xs font-bold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Add to today’s batch
              </button>
            </div>
          </form>

          <section className="mt-8 border-t border-separator pt-5" aria-labelledby="batch-heading">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="batch-heading" className="text-sm font-bold text-foreground">Today’s batch <span className="ml-1 rounded-full bg-default px-2 py-0.5 text-[10px] font-semibold text-muted">{drafts.length}</span></h2>
                <p className="mt-1 text-[11px] text-muted">Review each new or updated customer before sending the batch.</p>
              </div>
              <button type="button" onClick={() => void submitBatch()} disabled={!drafts.length || saving} className="btn-interactive inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-xs font-bold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {saving ? "Submitting batch…" : `Submit batch${drafts.length ? ` · ${drafts.length}` : ""}`}
              </button>
            </div>
            {drafts.length ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-separator">
                <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                  <thead className="bg-default/70 text-[10px] uppercase tracking-wide text-muted">
                    <tr><th className="px-3 py-2.5 font-semibold">New / update</th><th className="px-3 py-2.5 font-semibold">Customer</th><th className="px-3 py-2.5 font-semibold">Lead source</th><th className="px-3 py-2.5 font-semibold">Latest stage</th><th className="px-3 py-2.5 font-semibold">Notes</th><th className="px-3 py-2.5"><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {drafts.map((draft) => (
                      <tr key={draft.key} className="border-t border-separator align-top">
                        <td className="px-3 py-3 text-muted">{draft.mode === "new" ? "New" : "Update"}</td>
                        <td className="px-3 py-3"><span className="block font-semibold text-foreground">{draft.fullName}</span><span className="mt-0.5 block text-[11px] text-muted">{draft.phoneNumber}</span></td>
                        <td className="px-3 py-3 text-muted">{draft.leadSource ? <>{draft.leadSource}{draft.leadSourceDetail ? <span className="mt-1 block text-[10px]">{draft.leadSourceDetail}</span> : null}</> : "—"}</td>
                        <td className="px-3 py-3"><span className="whitespace-nowrap rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">{draft.pipelineStage}</span></td>
                        <td className="max-w-56 px-3 py-3"><span className="block line-clamp-2 leading-relaxed text-muted">{draft.note}</span>{draft.error ? <span className="mt-1 block text-[10px] text-danger">{draft.error}</span> : null}</td>
                        <td className="px-3 py-2"><button type="button" aria-label={`Remove ${draft.fullName} from batch`} onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))} disabled={saving} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-separator px-4 py-6 text-center">
                <p className="text-xs font-semibold text-foreground">No entries in this batch yet</p>
                <p className="mt-1 text-[11px] text-muted">Fill in a new customer or choose an existing one, then add it here for review.</p>
              </div>
            )}
          </section>
        </section>

        <aside className="border-t border-separator pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <h2 className="text-sm font-bold text-foreground">Pipeline stages</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">The same stage names used in the team’s daily entry sheet.</p>
          <ol className="mt-4 space-y-1.5" aria-label="Sales pipeline stages">
            {pipelineStages.map((stage, index) => {
              const active = stage === pipelineStage;
              return <li key={stage} aria-current={active ? "step" : undefined} className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs ${active ? "bg-accent/10 font-semibold text-accent" : "text-muted"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums ${active ? "bg-accent text-accent-foreground" : "bg-default text-muted"}`}>{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{stage}</span>
                {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </li>;
            })}
          </ol>
          <div className="mt-5 rounded-lg bg-default/70 p-3">
            <div className="flex gap-2 text-muted"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p className="text-[11px] leading-relaxed">A new customer starts at Lead. Every submitted update is timestamped with your account and kept in the activity history. Submitted updates cannot be edited or deleted.</p></div>
          </div>
          {selectedLead ? <p className="mt-4 text-[11px] text-muted">Last updated {formatDate(selectedLead.updatedAt)}{selectedLead.claimedBy?.name ? ` · assigned to ${selectedLead.claimedBy.name}` : ""}</p> : null}
        </aside>
      </div>
    </div>
  );
}
