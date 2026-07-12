import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
}

export function BarChart({
  data,
  xKey,
  yKeys,
  colors = ["#309477", "#cda043", "#e67768"],
  layout = "horizontal",
  stacked = false
}: BarChartProps) {
  const isHorizontal = layout === "horizontal";

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 10, left: isHorizontal ? -20 : 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--separator)"
            vertical={!isHorizontal}
            horizontal={isHorizontal}
          />
          {isHorizontal ? (
            <XAxis
              dataKey={xKey}
              type="category"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
            />
          ) : (
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
            />
          )}
          {isHorizontal ? (
            <YAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
              allowDecimals={false}
            />
          ) : (
            <YAxis
              dataKey={xKey}
              type="category"
              tickLine={false}
              axisLine={false}
              width={90}
              tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
            />
          )}
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--border)", opacity: 0.15 }} />
          {yKeys.map((yKey, index) => (
            <Bar
              key={yKey}
              dataKey={yKey}
              name={yKey.charAt(0).toUpperCase() + yKey.slice(1)}
              stackId={stacked ? "stack" : undefined}
              fill={colors[index % colors.length]}
              radius={
                isHorizontal
                  ? [4, 4, 0, 0] // round top corners
                  : [0, 4, 4, 0] // round right corners
              }
              activeBar={{
                fillOpacity: 0.85,
                stroke: "var(--foreground)",
                strokeWidth: 1
              }}
            >
              {data.map((entry, cellIndex) => (
                <Cell 
                  key={`cell-${cellIndex}`} 
                  fill={(entry.fill as string | undefined) || colors[index % colors.length]} 
                />
              ))}
            </Bar>
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
