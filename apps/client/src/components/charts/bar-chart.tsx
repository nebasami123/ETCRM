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
  /** Optional domain for the numeric axis, e.g. [0, 100] for percentages. */
  domain?: [number, number];
  /** Optional display labels for yKeys (tooltip/legend). */
  yLabels?: Record<string, string>;
  /** Optional tick formatter for the numeric axis. */
  valueFormatter?: (value: number) => string;
  /** Optional barGap to control spacing between bars (e.g. "-100%" for overlapping). */
  barGap?: number | string;
  /** Optional maxBarSize to cap the bar width/height (defaults to 32 for sleek aesthetics). */
  maxBarSize?: number;
  /** Optional flag to draw bars overlapping (used for targets vs actuals). */
  overlapping?: boolean;
}

function defaultYLabel(yKey: string) {
  return yKey
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function BarChart({
  data,
  xKey,
  yKeys,
  colors = ["#309477", "#cda043", "#e67768"],
  layout = "horizontal",
  stacked = false,
  domain,
  yLabels,
  valueFormatter,
  barGap,
  maxBarSize = 32,
  overlapping
}: BarChartProps) {
  const isHorizontal = layout === "horizontal";
  const formatTick = (value: number) => (valueFormatter ? valueFormatter(value) : String(value));

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 10, left: isHorizontal ? -20 : 0, bottom: 0 }}
          barGap={barGap}
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
              domain={domain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
              tickFormatter={formatTick}
            />
          )}
          {isHorizontal ? (
            <YAxis
              type="number"
              domain={domain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 500 }}
              allowDecimals={false}
              tickFormatter={formatTick}
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
          {yKeys.map((yKey, index) => {
            const isOuterSegment = !stacked || index === yKeys.length - 1;
            return (
              <Bar
                key={yKey}
                dataKey={yKey}
                name={yLabels?.[yKey] ?? defaultYLabel(yKey)}
                stackId={stacked ? "stack" : undefined}
                fill={colors[index % colors.length]}
                maxBarSize={maxBarSize}
                radius={
                  !isOuterSegment
                    ? 0
                    : isHorizontal
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
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
