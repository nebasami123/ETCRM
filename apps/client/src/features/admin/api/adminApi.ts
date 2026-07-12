import { api } from "../../../api/client";
import type { Activity, AdminLeadForm, AdminSummary, Lead, LeadFilters, LeadPhase, Quota, SalesUserForm, UploadResult, UserSummary } from "../../../types";

export const adminApi = {
  getSummary: () => api.get<AdminSummary>("/admin/summary").then((res) => res.data),
  getSalesUsers: () => api.get<{ users: UserSummary[] }>("/admin/sales-users").then((res) => res.data.users),
  getLeads: (params: LeadFilters) => api.get<{ leads: Lead[] }>("/admin/leads", { params }).then((res) => res.data.leads),
  getQuotas: (params: { date: string }) => api.get<{ quotas: Quota[] }>("/admin/quotas", { params }).then((res) => res.data.quotas),
  getActivity: (params: { limit: number }) => api.get<{ activities: Activity[] }>("/admin/activity", { params }).then((res) => res.data.activities),
  saveQuota: (payload: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) => api.post("/admin/quotas", payload).then((res) => res.data),
  uploadLeads: (form: FormData) => api.post<UploadResult>("/admin/leads/upload", form).then((res) => res.data),
  createSalesUser: (payload: SalesUserForm) => api.post("/admin/sales-users", payload).then((res) => res.data),
  resetSalesUserPassword: (userId: string, newPassword: string) => api.post(`/admin/sales-users/${userId}/password`, { newPassword }),
  createLead: (payload: Omit<AdminLeadForm, "assignedToId">) => api.post("/admin/leads", payload).then((res) => res.data),
  assignLead: (leadId: string, salesUserId: string | null) => api.patch(`/admin/leads/${leadId}/assign`, { salesUserId }).then((res) => res.data),
  updateLeadPhase: (leadId: string, phase: LeadPhase, creditedUserId?: string) => api.patch(`/admin/leads/${leadId}/phase`, { phase, creditedUserId: creditedUserId || null }).then((res) => res.data),
  downloadReport: () => api.get("/admin/reports/export", { responseType: "blob" })
};
