import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  title = "No data available",
  description = "There are no records matching your request.",
  className = ""
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center border border-dashed border-separator rounded-xl ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/5 text-accent mb-3">
        <FolderOpen className="h-6 w-6" />
      </div>
      <h4 className="text-xs font-bold text-foreground">{title}</h4>
      <p className="text-[11px] text-muted max-w-60 mt-1 leading-relaxed">{description}</p>
    </div>
  );
}
