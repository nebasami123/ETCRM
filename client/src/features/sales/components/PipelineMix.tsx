import { Badge } from "../../../components/ui/Badge";
import type { SalesDashboardData } from "../../../types";

export function PipelineMix({ phaseChart }: { phaseChart: SalesDashboardData["phaseCounts"] }) {
  return (
    <div>
      <h2 className="text-lg font-bold">Pipeline Mix</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {phaseChart.map((item) => (
          <div key={item.phase} className="rounded border border-line p-3">
            <Badge phase={item.phase} />
            <p className="mt-2 text-2xl font-bold">{item._count.phase}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
