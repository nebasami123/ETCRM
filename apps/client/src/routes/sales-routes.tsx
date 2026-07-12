import { Route, Routes, Navigate } from "react-router-dom";
import { DashboardShell } from "../components/layout/dashboard-shell";
import { SalesOverview } from "../features/sales/pages/overview";
import { SalesPipeline } from "../features/sales/pages/pipeline";
import { SalesNewLead } from "../features/sales/pages/new-lead";
import { SalesSettings } from "../features/sales/pages/settings";

export function SalesRoutes() {
  return (
    <DashboardShell>
      <Routes>
        <Route index element={<SalesOverview />} />
        <Route path="pipeline" element={<SalesPipeline />} />
        <Route path="new" element={<SalesNewLead />} />
        <Route path="settings" element={<SalesSettings />} />
        {/* Fallback to index */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </DashboardShell>
  );
}
export default SalesRoutes;
