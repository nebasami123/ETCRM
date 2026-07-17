import { Route, Routes, Navigate } from "react-router-dom";
import { DashboardShell } from "../components/layout/dashboard-shell";
import { SalesOverview } from "../features/sales/pages/overview";
import { SalesPipeline } from "../features/sales/pages/pipeline";
import { SalesPlanner } from "../features/sales/pages/planner";
import { SalesNewLead } from "../features/sales/pages/new-lead";
import { SalesSettings } from "../features/sales/pages/settings";
import { SalesCampaigns } from "../features/sales/pages/campaigns";

export function SalesRoutes() {
  return (
    <DashboardShell>
      <Routes>
        <Route index element={<SalesOverview />} />
        <Route path="leads" element={<SalesPipeline scope="mine" />} />
        <Route path="campaigns" element={<SalesCampaigns />} />
        <Route path="lead-pool" element={<SalesPipeline scope="all" />} />
        <Route path="planner" element={<SalesPlanner />} />
        <Route path="pipeline" element={<Navigate to="/sales/leads" replace />} />
        <Route path="new" element={<SalesNewLead />} />
        <Route path="settings" element={<SalesSettings />} />
        {/* Fallback to index */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </DashboardShell>
  );
}
export default SalesRoutes;
