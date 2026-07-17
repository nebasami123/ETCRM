import { api } from "../../api/client";
import type {
  Lead,
  LeadLocationFilterOptions,
  LeadPhase,
  LeadSource,
  LeaderboardEntry,
  PaginatedLeads,
  Reminder,
  SalesCampaign,
  SalesDashboardData,
  SalesLeadForm,
  SalesTaskData,
  UploadResult
} from "../../types";

export const salesApi = {
  getDashboard: () => api.get<SalesDashboardData>("/sales/dashboard").then((res) => res.data),
  getLeaderboard: () => api.get<{ leaderboard: LeaderboardEntry[]; myStats: LeaderboardEntry | null }>("/sales/leaderboard").then((res) => res.data),
  getCampaigns: () => api.get<{ campaigns: SalesCampaign[] }>("/sales/campaigns").then((res) => res.data.campaigns),
  getLeads: (params: {
    scope: "mine" | "all";
    search: string;
    phase: LeadPhase | "ALL";
    region?: string;
    subcity?: string;
    sector?: string[];
    source?: LeadSource | "ALL" | "";
    campaignId?: string;
    page: number;
    pageSize: number;
  }) =>
    api
      .get<PaginatedLeads>("/sales/leads", {
        params: {
          ...params,
          sector: params.sector?.length ? params.sector.join(",") : undefined
        }
      })
      .then((res) => res.data),
  getLeadFilterOptions: () =>
    api.get<LeadLocationFilterOptions>("/sales/leads/filter-options").then((res) => res.data),
  getTasks: (params: { range: string; start?: string; end?: string }) => api.get<SalesTaskData>("/sales/tasks", { params }).then((res) => res.data),
  createReminder: (payload: { label: string; note?: string; dueAt: string }) => api.post<{ reminder: Reminder }>("/sales/reminders", payload).then((res) => res.data.reminder),
  setReminderComplete: (id: string, complete: boolean) => api.patch(`/sales/reminders/${id}`, { complete }),
  getLead: (leadId: string) => api.get<{ lead: Lead }>(`/sales/leads/${leadId}`).then((res) => res.data.lead),
  updatePhase: (leadId: string, phase: LeadPhase) => api.patch<{ lead: Lead }>(`/sales/leads/${leadId}/phase`, { phase }).then((res) => res.data.lead),
  addNote: (leadId: string, note: string) => api.post<{ lead: Lead }>(`/sales/leads/${leadId}/notes`, { note }).then((res) => res.data.lead),
  createLead: (payload: Omit<SalesLeadForm, "appointmentDate"> & { appointmentDate: string | null }) => api.post<{ lead: Lead }>("/sales/leads", payload).then((res) => res.data),
  uploadLeads: (form: FormData) => api.post<UploadResult>("/sales/leads/upload", form).then((res) => res.data),
  updateAppointment: (leadId: string, appointmentDate: string | null) => api.patch<{ lead: Lead }>(`/sales/leads/${leadId}/appointment`, { appointmentDate }).then((res) => res.data.lead),
  updateFollowUp: (leadId: string, nextFollowUpAt: string | null) => api.patch<{ lead: Lead }>(`/sales/leads/${leadId}/follow-up`, { nextFollowUpAt }).then((res) => res.data.lead),
  claimLead: (leadId: string) => api.post<{ lead: Lead }>(`/sales/leads/${leadId}/claim`).then((res) => res.data.lead),
  requestTransfer: (leadId: string, reason: string) => api.post(`/sales/leads/${leadId}/claim-transfer-requests`, { reason }).then((res) => res.data)
};
