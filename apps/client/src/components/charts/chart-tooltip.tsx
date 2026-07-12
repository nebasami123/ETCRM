interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-separator bg-overlay/95 p-2.5 shadow-overlay backdrop-blur-md">
      {label && <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((item: TooltipPayloadItem, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color || item.fill }}
            />
            <span className="text-muted font-medium">{item.name}:</span>
            <span className="font-extrabold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
