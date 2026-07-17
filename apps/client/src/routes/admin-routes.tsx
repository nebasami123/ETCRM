import { Route, Routes, Navigate } from "react-router-dom";
import { DashboardShell } from "../components/layout/dashboard-shell";
import { AdminOverview } from "../features/admin/pages/overview";
import { AdminLeads } from "../features/admin/pages/leads";
import { AdminTeam } from "../features/admin/pages/team";
import { AdminQuotas } from "../features/admin/pages/quotas";
import { AdminPerformance } from "../features/admin/pages/performance";
import { AdminReports } from "../features/admin/pages/reports";
import { AdminTransfers } from "../features/admin/pages/transfers";
import { AdminSettings } from "../features/admin/pages/settings";
import { AdminCampaigns } from "../features/admin/pages/campaigns";

export function AdminRoutes() {
  return (
    <DashboardShell>
      <Routes>
        <Route index element={<AdminOverview />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="campaigns" element={<AdminCampaigns />} />
        <Route path="campaigns/:campaignId" element={<AdminCampaigns />} />
        <Route path="team" element={<AdminTeam />} />
        <Route path="quotas" element={<AdminQuotas />} />
        <Route path="performance" element={<AdminPerformance />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="transfers" element={<AdminTransfers />} />
        <Route path="settings" element={<AdminSettings />} />
        {/* Fallback to index */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </DashboardShell>
  );
}
export default AdminRoutes;
