import { FolderOpen } from "lucide-react";
import { EmptyState as ArcEmptyState } from "../arc/empty-state/empty-state";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
  action?: ReactNode;
}

export function EmptyState({
  title = "No data available",
  description = "There are no records matching your request.",
  className = "",
  action
}: EmptyStateProps) {
  return (
    <ArcEmptyState title={title} description={description} icon={<FolderOpen size={22} />} action={action} className={className} />
  );
}
