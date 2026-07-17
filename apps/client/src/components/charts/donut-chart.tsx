import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

interface DonutChartProps {
  data: Record<string, unknown>[];
  dataKey?: string;
  nameKey?: string;
  colors?: string[];
  /** Percentage of the chart radius (0–100). Defaults keep a clear ring without clipping. */
  innerRadius?: number | string;
  outerRadius?: number | string;
}

export function DonutChart({
  data,
  dataKey = "value",
  nameKey = "name",
  colors = ["#309477", "#3b82f6", "#cda043", "#10b981", "#e67768"],
  innerRadius = "52%",
  outerRadius = "78%"
}: DonutChartProps) {
  return (
    <div className="h-full w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey={dataKey}
            nameKey={nameKey}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={(entry.fill as string | undefined) || colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
