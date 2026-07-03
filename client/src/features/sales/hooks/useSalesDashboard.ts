import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { errorMessage } from "../../../api/errors";
import type { Lead, LeadPhase, SalesDashboardData, SalesLeadForm } from "../../../types";
import { formatDate, toDateTimeLocalValue } from "../../../utils/format";
import { salesApi } from "../api/salesApi";

const emptyLead: SalesLeadForm = {
  fullName: "",
  phoneNumber: "",
  email: "",
  businessName: "",
  licenceNumber: "",
  businessRegion: "",
  businessWoreda: "",
  appointmentDate: ""
};

export function useSalesDashboard() {
  const [dashboard, setDashboard] = useState<SalesDashboardData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [phase, setPhase] = useState<LeadPhase>("NEW");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [newLead, setNewLead] = useState(emptyLead);

  const activeList = dashboard?.todoLeads?.length ? dashboard.todoLeads : leads;
  const visibleActiveList = activeList.filter((lead) => {
    const query = leadSearch.trim().toLowerCase();
    if (!query) return true;
    return [lead.fullName, lead.phoneNumber, lead.email, lead.businessName, lead.licenceNumber, lead.businessRegion, lead.businessWoreda]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const phaseChart = useMemo(() => dashboard?.phaseCounts || [], [dashboard]);

  async function loadDashboard() {
    const [dashboardData, loadedLeads] = await Promise.all([salesApi.getDashboard(), salesApi.getLeads()]);
    setDashboard(dashboardData);
    setLeads(loadedLeads);
    if (!activeLeadId && (dashboardData.todoLeads[0] || loadedLeads[0])) {
      setActiveLeadId((dashboardData.todoLeads[0] || loadedLeads[0]).id);
    }
  }

  async function loadLead(id: string | null) {
    if (!id) return;
    const lead = await salesApi.getLead(id);
    setActiveLead(lead);
    setPhase(lead.phase);
    setAppointmentDate(toDateTimeLocalValue(lead.appointmentDate));
  }

  useEffect(() => {
    loadDashboard().catch((error) => setNotice(errorMessage(error, "Could not load dashboard")));
  }, []);

  useEffect(() => {
    loadLead(activeLeadId).catch((error) => setNotice(errorMessage(error, "Could not load lead")));
  }, [activeLeadId]);

  async function savePhase() {
    if (!activeLead) return;
    const lead = await salesApi.updatePhase(activeLead.id, phase);
    setActiveLead(lead);
    setNotice("Phase updated.");
    await loadDashboard();
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLead || note.trim().length < 2) return;
    await salesApi.addNote(activeLead.id, note);
    setNote("");
    setNotice("Call note added.");
    await Promise.all([loadLead(activeLead.id), loadDashboard()]);
  }

  function updateNewLead(field: keyof SalesLeadForm, value: string) {
    setNewLead((current) => ({ ...current, [field]: value }));
  }

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      ...newLead,
      appointmentDate: newLead.appointmentDate ? new Date(newLead.appointmentDate).toISOString() : null
    };
    let data;
    try {
      data = await salesApi.createLead(payload);
      setNotice("Lead added and assigned to you.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not add lead."));
      return;
    }
    setNewLead(emptyLead);
    setActiveLeadId(data.lead.id);
    await loadDashboard();
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setNotice("Choose a CSV or Excel file first.");
    setIsUploading(true);
    setNotice("Uploading leads...");
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await salesApi.uploadLeads(form);
      const skippedText = data.skipped ? ` Skipped ${data.skipped}.` : "";
      const reasonText = data.skippedRows?.length ? ` First issue: row ${data.skippedRows[0].row} - ${data.skippedRows[0].reason}.` : "";
      setNotice(`Imported ${data.imported} leads and assigned them to you.${skippedText}${reasonText}`);
      setFile(null);
      await loadDashboard();
    } catch (error) {
      setNotice(errorMessage(error, "Could not upload leads."));
    } finally {
      setIsUploading(false);
    }
  }

  async function saveAppointment() {
    if (!activeLead) return;
    const payloadDate = appointmentDate ? new Date(appointmentDate).toISOString() : null;
    const lead = await salesApi.updateAppointment(activeLead.id, payloadDate);
    setActiveLead(lead);
    setAppointmentDate(toDateTimeLocalValue(lead.appointmentDate));
    setNotice("Appointment updated.");
    await loadDashboard();
  }

  const extraFields: Array<[string, string]> = activeLead
    ? [
        ["Business", activeLead.businessName],
        ["Amharic Name", activeLead.businessNameAmharic],
        ["Legal Status", activeLead.legalStatusNameEng],
        ["License", activeLead.licenceNumber],
        ["Renewed To", formatDate(activeLead.renewedTo)],
        ["Registered", formatDate(activeLead.dateRegistered)],
        ["Manager", [activeLead.managerFName, activeLead.managerMName, activeLead.managerLName].filter(Boolean).join(" ")],
        ["Business Tel", activeLead.businessTelephone],
        ["Region", activeLead.businessRegion],
        ["Zone", activeLead.businessZone],
        ["Woreda", activeLead.businessWoreda],
        ["Kebele", activeLead.businessKebele],
        ["House No.", activeLead.houseNumber],
        ["Activity", activeLead.englishDescription || activeLead.subGroupEn]
      ].filter((entry): entry is [string, string] => Boolean(entry[1] && entry[1] !== "None"))
    : [];

  return {
    dashboard,
    notice,
    statsProps: {
      dashboard
    },
    quotaProgressProps: {
      dashboard
    },
    pipelineMixProps: {
      phaseChart
    },
    uploadProps: {
      isUploading,
      setFile,
      uploadCsv
    },
    leadFormProps: {
      newLead,
      updateNewLead,
      createLead
    },
    todoLeadListProps: {
      visibleActiveList,
      activeLeadId,
      setActiveLeadId,
      leadSearch,
      setLeadSearch
    },
    leadDetailProps: {
      activeLead,
      phase,
      setPhase,
      appointmentDate,
      setAppointmentDate,
      note,
      setNote,
      savePhase,
      saveAppointment,
      addNote,
      extraFields
    }
  };
}
