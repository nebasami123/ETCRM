import { api } from "../../../api/client";
import type { Lead, LeadPhase, SalesDashboardData, SalesLeadForm, UploadResult } from "../../../types";

export const salesApi = {
  getDashboard: () => api.get<SalesDashboardData>("/sales/dashboard").then((res) => res.data),
  getLeads: () => api.get<{ leads: Lead[] }>("/sales/leads").then((res) => res.data.leads),
  getLead: (leadId: string) => api.get<{ lead: Lead }>(`/sales/leads/${leadId}`).then((res) => res.data.lead),
  updatePhase: (leadId: string, phase: LeadPhase) => api.patch<{ lead: Lead }>(`/sales/leads/${leadId}/phase`, { phase }).then((res) => res.data.lead),
  addNote: (leadId: string, note: string) => api.post(`/sales/leads/${leadId}/notes`, { note }).then((res) => res.data),
  createLead: (payload: Omit<SalesLeadForm, "appointmentDate"> & { appointmentDate: string | null }) => api.post<{ lead: Lead }>("/sales/leads", payload).then((res) => res.data),
  uploadLeads: (form: FormData) => api.post<UploadResult>("/sales/leads/upload", form).then((res) => res.data),
  updateAppointment: (leadId: string, appointmentDate: string | null) => api.patch<{ lead: Lead }>(`/sales/leads/${leadId}/appointment`, { appointmentDate }).then((res) => res.data.lead)
};
