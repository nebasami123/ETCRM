import { api } from "../../api/client";
import type {
  Activity,
  AdminLeadForm,
  AdminOverviewAggregates,
  AdminSummary,
  Campaign,
  CampaignAllocation,
  CampaignAnalyticsRow,
  CampaignFilters,
  CampaignPreview,
  CampaignSortMode,
  CampaignStatus,
  LeaderboardEntry,
  LeadFilters,
  LeadLocationFilterOptions,
  LeadPhase,
  PaginatedLeads,
  Quota,
  RegistryFilterOptions,
  SalesUserForm,
  UploadResult,
  UserSummary,
  AgentPerformanceMetrics
} from "../../types";
import type { ClaimRequest } from "./hooks/use-admin-transfers";

export const adminApi = {
  getSummary: () => api.get<AdminSummary>("/admin/summary").then((res) => res.data),
  getOverviewAggregates: () =>
    api.get<AdminOverviewAggregates>("/admin/overview-aggregates").then((res) => res.data),
  getLeaderboard: () =>
    api.get<{ leaderboard: LeaderboardEntry[] }>("/admin/leaderboard").then((res) => res.data.leaderboard),
  getSalesUsers: () => api.get<{ users: UserSummary[] }>("/admin/sales-users").then((res) => res.data.users),
  getAllUsers: () => api.get<{ users: UserSummary[] }>("/admin/users").then((res) => res.data.users),
  getLeads: (params: LeadFilters & { page: number; pageSize: number }) =>
    api
      .get<PaginatedLeads>("/admin/leads", {
        params: {
          ...params,
          sector: params.sector?.length ? params.sector.join(",") : undefined
        }
      })
      .then((res) => res.data),
  getLeadFilterOptions: () =>
    api.get<LeadLocationFilterOptions>("/admin/leads/filter-options").then((res) => res.data),
  getQuotas: (params: { date: string }) =>
    api.get<{ quotas: Quota[] }>("/admin/quotas", { params }).then((res) => res.data.quotas),
  getActivity: (params: { limit: number }) =>
    api.get<{ activities: Activity[] }>("/admin/activity", { params }).then((res) => res.data.activities),
  saveQuota: (payload: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) =>
    api.post("/admin/quotas", payload).then((res) => res.data),
  uploadLeads: (form: FormData) => api.post<UploadResult>("/admin/leads/upload", form).then((res) => res.data),
  createSalesUser: (payload: SalesUserForm) => api.post("/admin/sales-users", payload).then((res) => res.data),
  resetSalesUserPassword: (userId: string, newPassword: string) =>
    api.post(`/admin/sales-users/${userId}/password`, { newPassword }),
  createLead: (payload: Omit<AdminLeadForm, "assignedToId">) =>
    api.post("/admin/leads", payload).then((res) => res.data),
  updateLead: (leadId: string, payload: Omit<AdminLeadForm, "assignedToId">) =>
    api.patch(`/admin/leads/${leadId}`, payload).then((res) => res.data),
  assignLead: (leadId: string, salesUserId: string | null) =>
    api.patch(`/admin/leads/${leadId}/assign`, { salesUserId }).then((res) => res.data),
  bulkAssignLeads: (leadIds: string[], salesUserId: string | null) =>
    api.post<{ updated: number }>("/admin/leads/bulk-assign", { leadIds, salesUserId }).then((res) => res.data),
  bulkUpdatePhases: (leadIds: string[], phase: LeadPhase, creditedUserId?: string) =>
    api
      .post<{ updated: number }>("/admin/leads/bulk-phase", {
        leadIds,
        phase,
        creditedUserId: creditedUserId || null
      })
      .then((res) => res.data),
  updateLeadPhase: (leadId: string, phase: LeadPhase, creditedUserId?: string) =>
    api
      .patch(`/admin/leads/${leadId}/phase`, { phase, creditedUserId: creditedUserId || null })
      .then((res) => res.data),
  getTransferRequests: (status?: string) =>
    api
      .get<{ requests: ClaimRequest[] }>("/admin/claim-transfer-requests", { params: { status } })
      .then((res) => res.data.requests),
  getPendingTransferCount: () =>
    api.get<{ count: number }>("/admin/claim-transfer-requests/pending-count").then((res) => res.data.count),
  resolveTransferRequest: (requestId: string, approve: boolean) =>
    api.post(`/admin/claim-transfer-requests/${requestId}/resolve`, { approve }).then((res) => res.data),
  downloadReport: (params?: { from?: string; to?: string }) =>
    api.get("/admin/reports/export", { params, responseType: "blob" }),
  getPerformanceMetrics: (params: { from: string; to: string }) =>
    api
      .get<{ metrics: AgentPerformanceMetrics[] }>("/admin/performance-metrics", { params })
      .then((res) => res.data.metrics),
  getCampaigns: (status?: string) =>
    api.get<{ campaigns: Campaign[] }>("/admin/campaigns", { params: { status } }).then((res) => res.data.campaigns),
  getCampaign: (id: string) =>
    api.get<{ campaign: Campaign }>(`/admin/campaigns/${id}`).then((res) => res.data.campaign),
  getCampaignFilterOptions: () =>
    api.get<RegistryFilterOptions>("/admin/campaigns/filter-options").then((res) => res.data),
  previewCampaign: (payload: { filters?: CampaignFilters; sortMode?: CampaignSortMode; requested?: number }) =>
    api.post<CampaignPreview>("/admin/campaigns/preview", payload).then((res) => res.data),
  prepareCampaignPool: (
    id: string,
    payload: { filters?: CampaignFilters; sortMode?: CampaignSortMode; poolSize: number }
  ) =>
    api
      .post<{
        status: "ok";
        campaignId: string;
        requested: number;
        poolSize: number;
        scannedBusinesses: number;
        exhausted: boolean;
        sample: Array<{
          fullName: string;
          businessName: string;
          phoneNumber: string;
          capital: number;
          region: string;
          subcity: string;
        }>;
      }>(`/admin/campaigns/${id}/prepare-pool`, payload, { timeout: 180_000 })
      .then((res) => res.data),
  createCampaign: (payload: {
    name: string;
    label?: string | null;
    description?: string | null;
    filters?: CampaignFilters;
    sortMode?: CampaignSortMode;
    durationDays?: number;
    allocations?: CampaignAllocation[];
  }) => api.post<{ campaign: Campaign }>("/admin/campaigns", payload).then((res) => res.data.campaign),
  getCampaignAnalytics: () =>
    api.get<{ campaigns: CampaignAnalyticsRow[] }>("/admin/campaigns/analytics").then((res) => res.data.campaigns),
  updateCampaign: (
    id: string,
    payload: { name?: string; label?: string | null; description?: string | null; status?: CampaignStatus }
  ) => api.patch<{ campaign: Campaign }>(`/admin/campaigns/${id}`, payload).then((res) => res.data.campaign),
  launchCampaign: (
    id: string,
    payload: {
      filters?: CampaignFilters;
      sortMode?: CampaignSortMode;
      allocations: CampaignAllocation[];
    }
  ) =>
    api
      .post<{
        campaign: Campaign;
        results: { assigned: number; requested: number; matched: number };
        message?: string;
      }>(`/admin/campaigns/${id}/launch`, payload, { timeout: 180_000 })
      .then((res) => res.data),
  deleteCampaign: (id: string) => api.delete(`/admin/campaigns/${id}`)
};
