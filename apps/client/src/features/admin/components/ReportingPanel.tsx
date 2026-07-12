import { Download } from "lucide-react";

export function ReportingPanel({ onDownload }: { onDownload: () => Promise<void> }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Reporting</h2>
          <p className="mt-1 text-sm text-neutral-500">Export agent performance metrics as CSV.</p>
        </div>
        <button onClick={onDownload} className="inline-flex items-center gap-2 rounded border border-line px-4 py-2 font-semibold hover:bg-neutral-50">
          <Download size={18} />
          Export
        </button>
      </div>
    </section>
  );
}
