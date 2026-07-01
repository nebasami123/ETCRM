import { AdminLeadsTable } from "../../features/admin/components/AdminLeadsTable";
import { AdminStats } from "../../features/admin/components/AdminStats";
import { CreateSalesUserForm } from "../../features/admin/components/CreateSalesUserForm";
import { QuotaManagement } from "../../features/admin/components/QuotaManagement";
import { RecentActivity } from "../../features/admin/components/RecentActivity";
import { ReportingPanel } from "../../features/admin/components/ReportingPanel";
import { useAdminDashboard } from "../../features/admin/hooks/useAdminDashboard";
import { LeadForm } from "../../features/leads/components/LeadForm";
import { LeadUpload } from "../../features/leads/components/LeadUpload";
import { AppLayout } from "../../layouts/AppLayout";

export function AdminDashboard() {
  const admin = useAdminDashboard();

  return (
    <AppLayout title="Admin Dashboard" subtitle="Manage leads, quotas, and performance exports.">
      <AdminStats summary={admin.summary} />

      {admin.notice ? <div className="mt-5 rounded border border-line bg-white p-3 text-sm text-forest">{admin.notice}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <LeadUpload
          title="Bulk Upload Leads"
          description="Upload CSV or Excel. Real-estate columns are saved as extra lead fields."
          onFileChange={admin.uploadProps.setFile}
          onUpload={admin.uploadProps.uploadCsv}
        />
        <ReportingPanel onDownload={admin.reportProps.downloadReport} />
      </div>

      <QuotaManagement {...admin.quotaProps} />
      <CreateSalesUserForm {...admin.salesUserProps} />
      <LeadForm {...admin.leadFormProps} showAssignment />
      <RecentActivity {...admin.activityProps} onRefresh={admin.activityProps.loadData} />
      <AdminLeadsTable {...admin.leadsTableProps} />
    </AppLayout>
  );
}
