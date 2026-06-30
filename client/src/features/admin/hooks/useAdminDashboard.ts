import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { errorMessage } from "../../../api/errors";
import type { Activity, AdminLeadForm, AdminSummary, Lead, LeadFilters, LeadPhase, Quota, SalesUserForm, UserSummary } from "../../../types";
import { adminApi } from "../api/adminApi";
import { formatDate, todayInputValue } from "../../../utils/format";

const emptySalesUser: SalesUserForm = {
  name: "",
  email: "",
  password: ""
};

const emptyLead: AdminLeadForm = {
  fullName: "",
  phoneNumber: "",
  email: "",
  assignedToId: "",
  businessName: "",
  licenceNumber: "",
  businessRegion: "",
  businessWoreda: ""
};

const initialLeadFilters: LeadFilters = {
  search: "",
  phase: "ALL",
  assignedToId: "",
  createdById: ""
};

export function useAdminDashboard() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [salesUsers, setSalesUsers] = useState<UserSummary[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [date, setDate] = useState(todayInputValue());
  const [selectedUser, setSelectedUser] = useState("");
  const [callsTarget, setCallsTarget] = useState(10);
  const [leadsTarget, setLeadsTarget] = useState(8);
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [newSalesUser, setNewSalesUser] = useState(emptySalesUser);
  const [leadFilters, setLeadFilters] = useState(initialLeadFilters);
  const [newLead, setNewLead] = useState(emptyLead);

  const selectedQuota = useMemo(() => quotas.find((quota) => quota.salesUserId === selectedUser), [quotas, selectedUser]);

  async function loadData() {
    const [summaryData, users, loadedLeads, loadedQuotas, loadedActivities] = await Promise.all([
      adminApi.getSummary(),
      adminApi.getSalesUsers(),
      adminApi.getLeads(leadFilters),
      adminApi.getQuotas({ date }),
      adminApi.getActivity({ limit: 20 })
    ]);
    setSummary(summaryData);
    setSalesUsers(users);
    setLeads(loadedLeads);
    setQuotas(loadedQuotas);
    setActivities(loadedActivities);
    if (!selectedUser && users[0]) setSelectedUser(users[0].id);
  }

  useEffect(() => {
    loadData().catch((error) => setNotice(errorMessage(error, "Could not load dashboard")));
  }, [date, leadFilters]);

  useEffect(() => {
    if (selectedQuota) {
      setCallsTarget(selectedQuota.callsTarget);
      setLeadsTarget(selectedQuota.leadsTarget);
    }
  }, [selectedQuota]);

  async function saveQuota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    await adminApi.saveQuota({ salesUserId: selectedUser, date, callsTarget, leadsTarget });
    setNotice("Quota saved.");
    await loadData();
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setNotice("Choose a CSV file first.");
    const form = new FormData();
    form.append("file", file);
    const data = await adminApi.uploadLeads(form);
    const skippedText = data.skipped ? ` Skipped ${data.skipped}.` : "";
    const reasonText = data.skippedRows?.length ? ` First issue: row ${data.skippedRows[0].row} - ${data.skippedRows[0].reason}.` : "";
    setNotice(`Imported ${data.imported} leads.${skippedText}${reasonText}`);
    setFile(null);
    await loadData();
  }

  function updateNewLead(field: keyof AdminLeadForm, value: string) {
    setNewLead((current) => ({ ...current, [field]: value }));
  }

  function updateNewSalesUser(field: keyof SalesUserForm, value: string) {
    setNewSalesUser((current) => ({ ...current, [field]: value }));
  }

  async function createSalesUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    await adminApi.createSalesUser(newSalesUser);
    setNotice("Sales user created.");
    setNewSalesUser(emptySalesUser);
    await loadData();
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    try {
      await adminApi.createLead({ ...newLead, assignedToId: newLead.assignedToId || null });
      setNotice("Lead added.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not add lead."));
      return;
    }
    setNewLead(emptyLead);
    await loadData();
  }

  async function assignLead(leadId: string, salesUserId: string) {
    await adminApi.assignLead(leadId, salesUserId || null);
    setNotice("Lead assignment updated.");
    await loadData();
  }

  function updateLeadFilter(field: keyof LeadFilters, value: string) {
    setLeadFilters((current) => ({
      ...current,
      [field]: field === "phase" ? (value as LeadPhase | "ALL") : value
    }));
  }

  async function downloadReport() {
    const response = await adminApi.downloadReport();
    const url = URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = "agent-performance.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function activityLabel(activity: Activity) {
    const labels = {
      CALL_NOTE: "Call note added",
      PHASE_CHANGE: "Phase changed",
      APPOINTMENT_SET: "Appointment set",
      LEAD_CREATED: "Lead created/imported",
      LEAD_ASSIGNED: "Lead assigned"
    };
    return labels[activity.type] || activity.type;
  }

  function activityMeta(activity: Activity) {
    if (!activity.metadata) return "";
    try {
      const data = JSON.parse(activity.metadata) as { imported?: number; skipped?: number; from?: string; to?: string; appointmentDate?: string };
      if (data.imported != null) return `${data.imported} imported, ${data.skipped || 0} skipped`;
      if (data.from && data.to) return `${data.from} to ${data.to}`;
      if (data.appointmentDate) return formatDate(data.appointmentDate);
      return "";
    } catch {
      return "";
    }
  }

  return {
    summary,
    salesUsers,
    leads,
    activities,
    notice,
    quotaProps: {
      salesUsers,
      selectedUser,
      setSelectedUser,
      date,
      setDate,
      callsTarget,
      setCallsTarget,
      leadsTarget,
      setLeadsTarget,
      saveQuota
    },
    uploadProps: {
      setFile,
      uploadCsv
    },
    reportProps: {
      downloadReport
    },
    salesUserProps: {
      newSalesUser,
      updateNewSalesUser,
      createSalesUser
    },
    leadFormProps: {
      newLead,
      salesUsers,
      updateNewLead,
      createLead
    },
    activityProps: {
      activities,
      activityLabel,
      activityMeta,
      loadData
    },
    leadsTableProps: {
      leads,
      salesUsers,
      leadFilters,
      updateLeadFilter,
      assignLead
    }
  };
}
