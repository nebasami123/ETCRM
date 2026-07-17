import { Card } from "./card";

interface KPICardProps {
  label: string;
  value: string | number;
  tone?: "accent" | "success" | "warning" | "danger" | "default";
}

export function KPICard({ label, value, tone = "default" }: KPICardProps) {
  const toneStyles = {
    accent: {
      gradient: "bg-gradient-to-br from-accent/4 via-surface to-surface",
      glow: "bg-accent/4 opacity-0 group-hover:opacity-100",
      text: "text-accent",
      colorVar: "var(--accent)"
    },
    success: {
      gradient: "bg-gradient-to-br from-success/4 via-surface to-surface",
      glow: "bg-success/4 opacity-0 group-hover:opacity-100",
      text: "text-success",
      colorVar: "var(--success)"
    },
    warning: {
      gradient: "bg-gradient-to-br from-warning/4 via-surface to-surface",
      glow: "bg-warning/4 opacity-0 group-hover:opacity-100",
      text: "text-warning",
      colorVar: "var(--warning)"
    },
    danger: {
      gradient: "bg-gradient-to-br from-danger/4 via-surface to-surface",
      glow: "bg-danger/4 opacity-0 group-hover:opacity-100",
      text: "text-danger",
      colorVar: "var(--danger)"
    },
    default: {
      gradient: "bg-gradient-to-br from-default/10 via-surface to-surface",
      glow: "bg-muted/3 opacity-0 group-hover:opacity-100",
      text: "text-foreground",
      colorVar: "var(--border)"
    }
  };

  const current = toneStyles[tone] || toneStyles.default;
  const displayValue =
    typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : value;

  return (
    <Card 
      className={`premium-card group relative overflow-hidden ${current.gradient} p-5 shadow-surface hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out-smooth`}
      style={{ "--card-glow": current.colorVar } as React.CSSProperties}
    >
      {/* Decorative Glow Shape */}
      <div className={`absolute -right-6 -bottom-6 w-20 h-20 rounded-full ${current.glow} blur-xl pointer-events-none group-hover:scale-170 transition-all duration-500 ease-out-smooth`} />

      <p className="text-[11px] font-bold uppercase tracking-wider text-muted select-none">{label}</p>
      <p className={`mt-2.5 text-3xl font-extrabold ${current.text} leading-none tracking-tight`}>{displayValue}</p>
    </Card>
  );
}



