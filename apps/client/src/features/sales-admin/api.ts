import { api } from "../../api/client";
import type { Activity, Lead, SalesAdminDashboardData, SalesType, UserSummary } from "../../types";

export interface ManagedUser extends UserSummary { email: string; role: "SALES"; salesType: SalesType | null; banned: boolean | null; }
export interface ManagedQuota { id: string; salesUserId: string; callsTarget: number; leadsTarget: number; salesUser: { id: string; name: string; email: string }; }
export const salesAdminApi = {
  dashboard: () => api.get<SalesAdminDashboardData>("/sales-admin/dashboard").then((r) => r.data),
  team: () => api.get<{ users: ManagedUser[] }>("/sales-admin/team").then((r) => r.data.users),
  createRep: (payload: { name: string; email: string; password: string; salesType: SalesType }) => api.post("/sales-admin/team", payload),
  setStatus: (id: string, active: boolean) => api.patch(`/sales-admin/team/${id}/status`, { active }),
  setType: (id: string, salesType: SalesType) => api.patch(`/sales-admin/team/${id}/type`, { salesType }),
  resetPassword: (id: string, newPassword: string) => api.post(`/sales-admin/team/${id}/password`, { newPassword }),
  leads: (params: { search: string; page: number; pageSize: number; stage?: string }) => api.get<{ leads: Lead[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>("/sales-admin/leads", { params }).then((r) => r.data),
  assign: (leadId: string, salesUserId: string | null) => api.patch(`/sales-admin/leads/${leadId}/assign`, { salesUserId }),
  activity: () => api.get<{ activities: Activity[] }>("/sales-admin/activity", { params: { page: 1, limit: 50 } }).then((r) => r.data.activities),
  quotas: (date: string) => api.get<{ quotas: ManagedQuota[] }>("/sales-admin/quotas", { params: { date } }).then((r) => r.data.quotas),
  saveQuota: (payload: { salesUserId: string; date: string; callsTarget: number; leadsTarget: number }) => api.post("/sales-admin/quotas", payload)
};
