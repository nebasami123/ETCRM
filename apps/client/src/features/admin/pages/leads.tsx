import { useState } from "react";
import { Plus, Upload, Search, ShieldCheck, Pencil, X, Phone, Mail } from "lucide-react";
import { useAdminLeads } from "../hooks/use-admin-leads";
import { FileDropzone } from "../../../components/ui/file-dropzone";
import { LeadForm } from "../../../components/forms/lead-form";
import { phaseOptions, formatDate, formatCapital, toDateTimeLocalValue, phaseLabels } from "../../../lib/utils/format";
import { filterAddisSubcities, isAddisAbabaRegion } from "../../../lib/utils/addis-subcities";
import type { Lead, LeadPhase } from "../../../types";
import { Card } from "../../../components/ui/card";
import { CustomSelect } from "../../../components/ui/custom-select";
import { CustomMultiSelect } from "../../../components/ui/custom-multi-select";
import { Pagination } from "../../../components/ui/pagination";
import { PhaseBadge } from "../../../components/ui/phase-badge";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "bg-accent/10 border-accent/20 text-accent hover:bg-accent/15",
  CONTACTED: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15",
  FOLLOW_UP: "bg-warning/10 border-warning/20 text-warning hover:bg-warning/15",
  N_A: "bg-muted/20 border-border text-muted hover:bg-muted/30",
  CLOSED_WON: "bg-success/10 border-success/20 text-success hover:bg-success/15",
  CLOSED_LOST: "bg-danger/10 border-danger/20 text-danger hover:bg-danger/15"
};

export function AdminLeads() {
  const leadsHook = useAdminLeads();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeEditLead, setActiveEditLead] = useState<Lead | null>(null);
  const [viewLead, setViewLead] = useState<Lead | null>(null);


  // Credit assignment state when phase goes CLOSED_WON
  const [activeWonLeadId, setActiveWonLeadId] = useState<string | null>(null);
  const [creditedUserId, setCreditedUserId] = useState("");
  const [bulkPhase, setBulkPhase] = useState<LeadPhase | "">("");
  const [bulkAssignTo, setBulkAssignTo] = useState("");
  const [bulkWonCredit, setBulkWonCredit] = useState("");

  const handlePhaseChange = (leadId: string, phase: LeadPhase) => {
    if (phase === "CLOSED_WON") {
      setActiveWonLeadId(leadId);
      setCreditedUserId("");
    } else {
      leadsHook.updateLeadPhase(leadId, phase);
    }
  };

  const submitWonPhase = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeWonLeadId && creditedUserId) {
      leadsHook.updateLeadPhase(activeWonLeadId, "CLOSED_WON", creditedUserId);
      setActiveWonLeadId(null);
    }
  };

  const applyBulkAssign = async () => {
    await leadsHook.bulkAssign(bulkAssignTo || null);
    setBulkAssignTo("");
  };

  const applyBulkPhase = async () => {
    if (!bulkPhase) return;
    if (bulkPhase === "CLOSED_WON") {
      if (!bulkWonCredit) return;
      await leadsHook.bulkPhase("CLOSED_WON", bulkWonCredit);
    } else {
      await leadsHook.bulkPhase(bulkPhase);
    }
    setBulkPhase("");
    setBulkWonCredit("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Leads Management</h2>
          <p className="text-xs text-muted mt-1">Search, assign, and manage every lead in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="btn-interactive px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-border hover:bg-default text-foreground"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5 shrink-0 inline-block" />
            Upload CSV
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="btn-interactive px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-foreground hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5 shrink-0 inline-block" />
            Create Lead
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="rounded-xl border border-separator bg-surface p-4 shadow-surface">
        <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted shrink-0" />
            <input
              type="text"
              placeholder="Search leads..."
              value={leadsHook.leadFilters.search}
              onChange={(e) => leadsHook.updateLeadFilter("search", e.target.value)}
              className="w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
            />
          </div>

          <CustomSelect
            value={leadsHook.leadFilters.phase}
            onChange={(val) => leadsHook.updateLeadFilter("phase", val)}
            options={[
              { value: "ALL", label: "All Phases" },
              ...phaseOptions
            ]}
            placeholder="Phase"
            ariaLabel="Filter by phase"
          />

          <CustomSelect
            value={leadsHook.leadFilters.claimedById}
            onChange={(val) => leadsHook.updateLeadFilter("claimedById", val)}
            options={[
              { value: "", label: "All Claimers" },
              { value: "UNCLAIMED", label: "Unclaimed" },
              ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
            ]}
            placeholder="Claimer"
            loading={leadsHook.isLoading && !leadsHook.salesUsers.length}
            ariaLabel="Filter by claimer"
          />

          <CustomSelect
            value={leadsHook.leadFilters.createdById}
            onChange={(val) => leadsHook.updateLeadFilter("createdById", val)}
            options={[
              { value: "", label: "All Creators" },
              ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
            ]}
            placeholder="Creator"
            loading={leadsHook.isLoading && !leadsHook.salesUsers.length}
            ariaLabel="Filter by creator"
          />

          <CustomSelect
            value={leadsHook.leadFilters.region || ""}
            onChange={(val) => {
              leadsHook.updateLeadFilter("region", val);
              if (!isAddisAbabaRegion(val)) leadsHook.updateLeadFilter("subcity", "");
            }}
            options={[
              { value: "", label: "All regions" },
              ...leadsHook.locationOptions.regions.map((item) => ({ value: item, label: item }))
            ]}
            placeholder="Region"
            loading={leadsHook.isFilterOptionsLoading}
            ariaLabel="Filter by region"
          />

          <CustomSelect
            value={leadsHook.leadFilters.subcity || ""}
            onChange={(val) => leadsHook.updateLeadFilter("subcity", val)}
            disabled={!isAddisAbabaRegion(leadsHook.leadFilters.region)}
            options={[
              {
                value: "",
                label: isAddisAbabaRegion(leadsHook.leadFilters.region)
                  ? "All Addis subcities"
                  : "Select Addis Ababa region first"
              },
              ...(isAddisAbabaRegion(leadsHook.leadFilters.region)
                ? filterAddisSubcities(leadsHook.locationOptions.subcities).map((item) => ({
                    value: item,
                    label: item
                  }))
                : [])
            ]}
            placeholder="Subcity"
            loading={leadsHook.isFilterOptionsLoading}
            ariaLabel="Filter by subcity"
          />

          <CustomMultiSelect
            value={leadsHook.leadFilters.sector || []}
            onChange={(val) => leadsHook.updateLeadFilter("sector", val)}
            options={(leadsHook.locationOptions.sectors || []).map((item) => ({ value: item, label: item }))}
            placeholder="Sector"
            emptyLabel="All sectors"
            loading={leadsHook.isFilterOptionsLoading}
            ariaLabel="Filter by sector"
          />

          <CustomSelect
            value={leadsHook.leadFilters.source || "ALL"}
            onChange={(val) => leadsHook.updateLeadFilter("source", val)}
            options={[
              { value: "ALL", label: "All sources" },
              { value: "LOCAL", label: "Manually added" },
              { value: "MONGO", label: "Business registry" }
            ]}
            placeholder="Source"
            ariaLabel="Filter by source"
          />
        </div>
        {leadsHook.hasActiveFilters ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={leadsHook.clearLeadFilters}
              className="btn-interactive inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          </div>
        ) : null}
      </Card>

      {leadsHook.selectedIds.length > 0 && (
        <Card className="rounded-xl border border-accent/30 bg-accent/5 p-4 shadow-surface">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <p className="text-xs font-bold text-foreground">{leadsHook.selectedIds.length} lead(s) selected</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                Bulk assign
                <CustomSelect
                  value={bulkAssignTo}
                  onChange={setBulkAssignTo}
                  options={[
                    { value: "", label: "Unclaim" },
                    ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
                  ]}
                  className="mt-1 min-w-40"
                  ariaLabel="Bulk assign owner"
                />
              </label>
              <button
                onClick={applyBulkAssign}
                className="btn-interactive rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold hover:bg-default"
              >
                Apply assignment
              </button>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                Bulk phase
                <CustomSelect
                  value={bulkPhase}
                  onChange={(val) => setBulkPhase(val as LeadPhase | "")}
                  options={[{ value: "", label: "Select phase…" }, ...phaseOptions]}
                  className="mt-1 min-w-40"
                  ariaLabel="Bulk phase"
                />
              </label>
              {bulkPhase === "CLOSED_WON" && (
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  Credit agent
                  <CustomSelect
                    value={bulkWonCredit}
                    onChange={setBulkWonCredit}
                    options={[
                      { value: "", label: "Select agent…" },
                      ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
                    ]}
                    className="mt-1 min-w-40"
                    ariaLabel="Bulk win credit"
                  />
                </label>
              )}
              <button
                onClick={applyBulkPhase}
                disabled={!bulkPhase || (bulkPhase === "CLOSED_WON" && !bulkWonCredit)}
                className="btn-interactive rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-40"
              >
                Apply phase
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Leads Table Card */}
      <Card className="rounded-xl border border-separator bg-surface shadow-surface overflow-hidden">
        <div className="overflow-x-auto" data-scrollbar="thin">
          <table className="w-full min-w-225 text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-separator bg-default/40 text-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={leadsHook.leads.length > 0 && leadsHook.selectedIds.length === leadsHook.leads.length}
                    onChange={leadsHook.toggleSelectAll}
                    aria-label="Select all leads on page"
                  />
                </th>
                <th className="px-5 py-3">Lead Info</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">License Info</th>
                <th className="px-5 py-3">Region / Subcity</th>
                <th className="px-5 py-3">Current Phase</th>
                <th className="px-5 py-3">Claim Status</th>
                <th className="px-5 py-3">Dates</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-separator text-foreground font-medium">
              {leadsHook.isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-muted">
                    Loading pipeline data...
                  </td>
                </tr>
              ) : leadsHook.leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-muted">
                    No leads match your active filters.
                  </td>
                </tr>
              ) : (
                leadsHook.leads.map((lead) => {
                  const isMongoLead = lead.source === "MONGO" || Boolean(lead.isVirtual);
                  return (
                  <tr
                    key={lead.id}
                    className="hover:bg-default/20 transition-colors duration-160 cursor-pointer"
                    onClick={() => setViewLead(lead)}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={leadsHook.selectedIds.includes(lead.id)}
                        onChange={() => leadsHook.toggleSelect(lead.id)}
                        aria-label={`Select ${lead.fullName}`}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-bold text-foreground">{lead.fullName}</p>
                      <p className="text-[10px] text-muted">{lead.email || "No email provided"}</p>
                    </td>
                    <td className="px-5 py-3 font-mono">{lead.phoneNumber}</td>
                    <td className="px-5 py-3 font-mono">{lead.licenceNumber || "—"}</td>
                    <td className="px-5 py-3">
                      <p>{lead.businessRegion || "—"}</p>
                      <p className="text-[10px] text-muted">{lead.businessWoreda || "—"}</p>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {lead.isVirtual ? (
                        <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">NEW</span>
                      ) : (
                        <CustomSelect
                          value={lead.phase}
                          onChange={(val) => handlePhaseChange(lead.id, val as LeadPhase)}
                          options={phaseOptions}
                          size="sm"
                          triggerClassName={`${phaseColors[lead.phase]} font-bold tracking-normal uppercase`}
                          ariaLabel={`Update phase for ${lead.fullName}`}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {lead.isVirtual ? (
                        <span className="text-[10px] text-muted">Claim from sales pool</span>
                      ) : (
                        <CustomSelect
                          value={lead.claimedBy?.id || ""}
                          onChange={(val) => leadsHook.assignLead(lead.id, val || null)}
                          options={[
                            { value: "", label: "Unclaimed (Queue)" },
                            ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
                          ]}
                          size="sm"
                          ariaLabel={`Assign owner for ${lead.fullName}`}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3 text-[10px] text-muted space-y-0.5">
                      <p>Appt: <span className="font-semibold text-foreground">{formatDate(lead.appointmentDate)}</span></p>
                      <p>Follow: <span className="font-semibold text-foreground">{formatDate(lead.nextFollowUpAt)}</span></p>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={isMongoLead}
                        onClick={() => {
                          if (isMongoLead) return;
                          setActiveEditLead(lead);
                          setEditModalOpen(true);
                        }}
                        className="btn-interactive p-1.5 rounded-lg border border-border bg-surface hover:bg-default text-muted hover:text-foreground inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                        title={isMongoLead ? "Business registry leads can't be edited" : "Edit lead"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={leadsHook.pagination} onPageChange={leadsHook.setPage} />
      </Card>

      {/* Create Lead Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
          <div className="relative w-full max-w-lg z-10 animate-in fade-in zoom-in-95 duration-200 ease-out-smooth">
            <LeadForm
              title="Add New Lead"
              salesUsers={leadsHook.salesUsers}
              onSubmit={async (values) => {
                await leadsHook.createLead(values);
                setCreateModalOpen(false);
              }}
              showAssignment
            />
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editModalOpen && activeEditLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm" onClick={() => {
            setEditModalOpen(false);
            setActiveEditLead(null);
          }} />
          <div className="relative w-full max-w-lg z-10 animate-in fade-in zoom-in-95 duration-200 ease-out-smooth">
            <LeadForm
              title={`Edit Lead: ${activeEditLead.fullName}`}
              salesUsers={leadsHook.salesUsers}
              initialValues={{
                fullName: activeEditLead.fullName,
                phoneNumber: activeEditLead.phoneNumber,
                email: activeEditLead.email || "",
                businessName: activeEditLead.businessName || "",
                licenceNumber: activeEditLead.licenceNumber || "",
                businessRegion: activeEditLead.businessRegion || "",
                businessWoreda: activeEditLead.businessWoreda || "",
                appointmentDate: toDateTimeLocalValue(activeEditLead.appointmentDate),
                assignedToId: activeEditLead.claimedBy?.id || ""
              }}
              onSubmit={async (values) => {
                await leadsHook.updateLead(activeEditLead.id, values);
                setEditModalOpen(false);
                setActiveEditLead(null);
              }}
              showAssignment
            />
          </div>
        </div>
      )}

      {/* Upload CSV Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setUploadModalOpen(false)} />
          <div className="relative w-full max-w-md z-10 animate-in fade-in zoom-in-95 duration-200 ease-out-smooth">
            <FileDropzone
              title="Upload Lead Database (CSV)"
              description="Drop your CSV or Excel lead list here. Real-estate custom columns are automatically preserved."
              isUploading={leadsHook.isUploading}
              onFileChange={() => {}}
              onUpload={async (file) => {
                await leadsHook.uploadLeads(file);
                setUploadModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Credit assignment closed won modal */}
      {activeWonLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm" onClick={() => setActiveWonLeadId(null)} />
          <div className="relative w-full max-w-sm rounded-xl border border-separator bg-overlay p-6 shadow-overlay z-10 animate-in fade-in scale-95 duration-200 ease-out-smooth">
            <div className="flex items-center gap-2 text-success mb-2">
              <ShieldCheck className="h-5 w-5" />
              <h3 className="text-base font-bold text-foreground">Record Conversion Credit</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              To close this lead as <strong className="font-bold">WON</strong>, you must attribute the sale conversion credit to a salesperson.
            </p>

            <form onSubmit={submitWonPhase} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground">Credited Salesperson</label>
                <CustomSelect
                  value={creditedUserId}
                  onChange={setCreditedUserId}
                  options={[
                    { value: "", label: "Select agent..." },
                    ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
                  ]}
                  className="mt-1"
                  placeholder="Select agent..."
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveWonLeadId(null)}
                  className="btn-interactive px-3.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-default"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!creditedUserId}
                  className="btn-interactive px-3.5 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  Confirm Win
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewLead ? <AdminLeadDossier lead={viewLead} onClose={() => setViewLead(null)} /> : null}
    </div>
  );
}

function AdminLeadDossier({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const isMongo = lead.source === "MONGO" || Boolean(lead.isVirtual);
  const fields: Array<[string, string]> = [
    ["Business", lead.businessName || ""],
    ["License", lead.licenceNumber || ""],
    ["Source", isMongo ? "Business directory" : "Manually added"],
    ["Region", lead.businessRegion || ""],
    ["Zone", lead.businessZone || ""],
    ["Subcity / Woreda", lead.businessWoreda || ""],
    ["Manager", [lead.managerFName, lead.managerMName, lead.managerLName].filter(Boolean).join(" ")],
    ["TIN", lead.registry?.tin || lead.licenceNumber || ""],
    ["Capital", lead.registry?.capital != null ? formatCapital(lead.registry.capital) : ""],
    ["Score", lead.registry?.value != null ? formatCapital(lead.registry.value) : ""],
    ["Nationality", lead.registry?.nationality || ""],
    ["Phase", phaseLabels[lead.phase] || lead.phase],
    ["Claimed by", lead.claimedBy?.name || "Unclaimed"]
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Lead details"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-separator bg-surface shadow-overlay sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-separator bg-default/20 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Lead dossier</p>
            <h2 className="mt-1 truncate text-xl font-black tracking-tight text-foreground">{lead.fullName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PhaseBadge phase={lead.phase} />
              {lead.isVirtual ? (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">LIVE · NEW</span>
              ) : null}
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

        <div className="space-y-6 overflow-y-auto p-5 sm:p-7" data-scrollbar="thin">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Contact</h3>
            <div className="mt-3 grid gap-2 rounded-xl border border-separator bg-default/10 p-4 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="h-3.5 w-3.5 text-muted" />
                <span className="font-mono font-semibold">{lead.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="h-3.5 w-3.5 text-muted" />
                <span className="font-semibold">{lead.email || "No email"}</span>
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
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
                  <dd className="mt-0.5 truncate font-semibold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLeads;
