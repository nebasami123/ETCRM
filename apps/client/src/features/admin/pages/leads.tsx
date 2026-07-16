import { useState } from "react";
import { Plus, Upload, Search, ShieldCheck, Pencil } from "lucide-react";
import { useAdminLeads } from "../hooks/use-admin-leads";
import { FileDropzone } from "../../../components/ui/file-dropzone";
import { LeadForm } from "../../../components/forms/lead-form";
import { phaseOptions, formatDate, toDateTimeLocalValue } from "../../../lib/utils/format";
import type { Lead, LeadPhase } from "../../../types";
import { Card } from "../../../components/ui/card";
import { CustomSelect } from "../../../components/ui/custom-select";
import { Pagination } from "../../../components/ui/pagination";

const phaseColors: Record<LeadPhase, string> = {
  NEW: "bg-accent/10 border-accent/20 text-accent hover:bg-accent/15",
  CONTACTED: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15",
  FOLLOW_UP: "bg-warning/10 border-warning/20 text-warning hover:bg-warning/15",
  CLOSED_WON: "bg-success/10 border-success/20 text-success hover:bg-success/15",
  CLOSED_LOST: "bg-danger/10 border-danger/20 text-danger hover:bg-danger/15"
};

export function AdminLeads() {
  const leadsHook = useAdminLeads();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeEditLead, setActiveEditLead] = useState<Lead | null>(null);


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
          <p className="text-xs text-muted mt-1">Review, assign, and manage pipeline conversions.</p>
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
        <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-4">
          {/* Search */}
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

          {/* Phase Filter */}
          <CustomSelect
            value={leadsHook.leadFilters.phase}
            onChange={(val) => leadsHook.updateLeadFilter("phase", val)}
            options={[
              { value: "ALL", label: "All Phases" },
              ...phaseOptions
            ]}
            ariaLabel="Filter by phase"
          />

          {/* Claimed By Filter */}
          <CustomSelect
            value={leadsHook.leadFilters.claimedById}
            onChange={(val) => leadsHook.updateLeadFilter("claimedById", val)}
            options={[
              { value: "", label: "All Claimers" },
              { value: "UNCLAIMED", label: "Unclaimed" },
              ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
            ]}
            ariaLabel="Filter by claimer"
          />

          {/* Created By Filter */}
          <CustomSelect
            value={leadsHook.leadFilters.createdById}
            onChange={(val) => leadsHook.updateLeadFilter("createdById", val)}
            options={[
              { value: "", label: "All Creators" },
              ...leadsHook.salesUsers.map((user) => ({ value: user.id, label: user.name }))
            ]}
            ariaLabel="Filter by creator"
          />
        </div>
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
                <th className="px-5 py-3">Region</th>
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
                leadsHook.leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-default/20 transition-colors duration-160">
                    <td className="px-3 py-3">
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
                    <td className="px-5 py-3">{lead.businessRegion || "—"}</td>
                    <td className="px-5 py-3">
                      <CustomSelect
                        value={lead.phase}
                        onChange={(val) => handlePhaseChange(lead.id, val as LeadPhase)}
                        options={phaseOptions}
                        size="sm"
                        triggerClassName={`${phaseColors[lead.phase]} font-bold tracking-normal uppercase`}
                        ariaLabel={`Update phase for ${lead.fullName}`}
                      />
                    </td>
                    <td className="px-5 py-3">
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
                    </td>
                    <td className="px-5 py-3 text-[10px] text-muted space-y-0.5">
                      <p>Appt: <span className="font-semibold text-foreground">{formatDate(lead.appointmentDate)}</span></p>
                      <p>Follow: <span className="font-semibold text-foreground">{formatDate(lead.nextFollowUpAt)}</span></p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setActiveEditLead(lead);
                          setEditModalOpen(true);
                        }}
                        className="btn-interactive p-1.5 rounded-lg border border-border bg-surface hover:bg-default text-muted hover:text-foreground inline-flex items-center justify-center"
                        title="Edit Lead Info"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}
export default AdminLeads;
