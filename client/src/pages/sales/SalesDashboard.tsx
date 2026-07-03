import { LeadDetailPanel } from "../../features/sales/components/LeadDetailPanel";
import { SalesPerformancePanel } from "../../features/sales/components/SalesPerformancePanel";
import { SalesStats } from "../../features/sales/components/SalesStats";
import { TodoLeadList } from "../../features/sales/components/TodoLeadList";
import { useSalesDashboard } from "../../features/sales/hooks/useSalesDashboard";
import { LeadForm } from "../../features/leads/components/LeadForm";
import { LeadUpload } from "../../features/leads/components/LeadUpload";
import { AppLayout } from "../../layouts/AppLayout";

export function SalesDashboard() {
  const sales = useSalesDashboard();

  return (
    <AppLayout title="Sales Dashboard" subtitle="Work through today's quota, follow-ups, and assigned leads.">
      <SalesStats {...sales.statsProps} />
      <SalesPerformancePanel dashboard={sales.dashboard} />

      {sales.notice ? <div className="mt-5 rounded border border-line bg-white p-3 text-sm text-forest">{sales.notice}</div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <LeadUpload
          title="Upload My Leads"
          description="CSV or Excel uploads are assigned to you automatically."
          isUploading={sales.uploadProps.isUploading}
          onFileChange={sales.uploadProps.setFile}
          onUpload={sales.uploadProps.uploadCsv}
        />
        <LeadForm
          {...sales.leadFormProps}
          showAppointment
          sectionClassName="rounded-lg border border-line bg-white p-5 shadow-soft"
          formClassName="mt-4 grid gap-3 sm:grid-cols-2"
          buttonClassName="rounded bg-ink px-4 py-2 font-semibold text-white sm:col-span-2"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <TodoLeadList {...sales.todoLeadListProps} />
        <LeadDetailPanel {...sales.leadDetailProps} />
      </div>
    </AppLayout>
  );
}
