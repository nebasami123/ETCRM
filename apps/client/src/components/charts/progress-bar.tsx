interface ProgressBarProps {
  value: number;
  target: number;
  label: string;
}

export function ProgressBar({ value, target, label }: ProgressBarProps) {
  const safeTarget = target <= 0 ? 1 : target;
  const percentage = Math.min(100, Math.round((value / safeTarget) * 100));

  return (
    <div className="rounded-lg border border-separator bg-surface p-3.5 shadow-surface">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-foreground">{label}</span>
        <span className="text-muted">
          {value} <span className="text-muted/60 font-medium">/ {target}</span>
        </span>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-default/50">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out-smooth"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
