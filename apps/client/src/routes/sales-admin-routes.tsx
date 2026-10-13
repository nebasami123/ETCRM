import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardShell } from "../components/layout/dashboard-shell";
import { SalesAdminDashboard } from "../features/sales-admin/pages/dashboard";
import { SalesAdminTeam } from "../features/sales-admin/pages/team";
import { SalesAdminLeads } from "../features/sales-admin/pages/leads";
import { SalesAdminQuotas } from "../features/sales-admin/pages/quotas";
import { SalesAdminActivity } from "../features/sales-admin/pages/activity";

export function SalesAdminRoutes() {
  return <DashboardShell><Routes>
    <Route index element={<SalesAdminDashboard />} />
    <Route path="team" element={<SalesAdminTeam />} />
    <Route path="leads" element={<SalesAdminLeads />} />
    <Route path="quotas" element={<SalesAdminQuotas />} />
    <Route path="activity" element={<SalesAdminActivity />} />
    <Route path="*" element={<Navigate to="" replace />} />
  </Routes></DashboardShell>;
}
