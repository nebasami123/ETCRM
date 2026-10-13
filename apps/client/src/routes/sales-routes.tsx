import { Route, Routes, Navigate } from "react-router-dom";
import { DashboardShell } from "../components/layout/dashboard-shell";
import { SalesOverview } from "../features/sales/pages/overview";
import { SalesPipeline } from "../features/sales/pages/pipeline";
import { SalesPlanner } from "../features/sales/pages/planner";
import { SalesLeadLog } from "../features/sales/pages/lead-log";
import { SalesSettings } from "../features/sales/pages/settings";
import { SalesCampaigns } from "../features/sales/pages/campaigns";
import { useAuth } from "../hooks/use-auth";

export function SalesRoutes() {
  const { user } = useAuth();
  const isExternalSales = user?.salesType === "EXTERNAL";

  return (
    <DashboardShell>
      <Routes>
        <Route index element={isExternalSales ? <Navigate to="/sales/lead-log" replace /> : <SalesOverview />} />
        <Route path="leads" element={<SalesPipeline scope="mine" />} />
        {!isExternalSales && <Route path="campaigns" element={<SalesCampaigns />} />}
        {!isExternalSales && <Route path="lead-pool" element={<SalesPipeline scope="all" />} />}
        {!isExternalSales && <Route path="planner" element={<SalesPlanner />} />}
        <Route path="pipeline" element={<Navigate to="/sales/leads" replace />} />
        <Route path="lead-log" element={<SalesLeadLog />} />
        <Route path="new" element={<Navigate to="/sales/lead-log" replace />} />
        {!isExternalSales && <Route path="settings" element={<SalesSettings />} />}
        {/* Fallback to index */}
        <Route path="*" element={<Navigate to={isExternalSales ? "/sales/lead-log" : "/sales"} replace />} />
      </Routes>
    </DashboardShell>
  );
}
export default SalesRoutes;
