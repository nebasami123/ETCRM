import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer
} from "recharts";

interface RadarChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  angleKey: string;
  fillColor?: string;
  strokeColor?: string;
}

export function RadarChart({
  data,
  dataKey,
  angleKey,
  fillColor = "var(--accent)",
  strokeColor = "var(--accent)"
}: RadarChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={data} outerRadius={64}>
          <PolarGrid stroke="var(--separator)" />
          <PolarAngleAxis
            dataKey={angleKey}
            tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
          />
          <Radar
            name="Score"
            dataKey={dataKey}
            stroke={strokeColor}
            fill={fillColor}
            fillOpacity={0.16}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
