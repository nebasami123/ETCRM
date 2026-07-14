import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination as PaginationData } from "../../types";

interface PaginationProps {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  if (pagination.total === 0) return null;

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-col gap-3 border-t border-separator px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-muted">Showing {start}–{end} of {pagination.total} leads</p>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-interactive inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <span className="min-w-16 text-center text-[11px] font-semibold text-muted">{pagination.page} / {Math.max(1, pagination.totalPages)}</span>
        <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="btn-interactive inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
