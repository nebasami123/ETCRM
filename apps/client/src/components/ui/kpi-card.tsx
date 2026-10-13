import { MetricCard } from "../arc/metric-card/metric-card";

interface KPICardProps {
  label: string;
  value: string | number;
  tone?: "accent" | "success" | "warning" | "danger" | "default";
}

export function KPICard({ label, value }: KPICardProps) {
  const raw = String(value);
  const match = raw.match(/^(-?[\d,]+(?:\.\d+)?)(.*)$/);
  if (!match) {
    return (
      <div className="crm-metric">
        <article className="crm-metric-fallback">
          <span>{label}</span>
          <strong>{raw}</strong>
        </article>
      </div>
    );
  }
  const amount = Number(match[1].replace(/,/g, ""));
  const suffix = match?.[2]?.trim() ?? "";

  return (
    <div className="crm-metric">
      <MetricCard label={label} value={amount} suffix={suffix} context="Current total" />
    </div>
  );
}
