import type { LeaderboardEntry } from "../../types";

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  highlightUserId?: string;
}

export function LeaderboardTable({ data, highlightUserId }: LeaderboardTableProps) {
  const sorted = [...data].sort((a, b) => b.conversions - a.conversions || b.conversionRate - a.conversionRate);

  if (sorted.length === 0) {
    return <p className="text-xs text-muted text-center py-4">No sales data yet</p>;
  }

  return (
    <div className="overflow-x-auto" data-scrollbar="thin">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-separator text-muted uppercase tracking-wider">
            <th className="text-left py-2 px-2 font-bold">#</th>
            <th className="text-left py-2 px-2 font-bold">Agent</th>
            <th className="text-right py-2 px-2 font-bold">Claimed</th>
            <th className="text-right py-2 px-2 font-bold">Won</th>
            <th className="text-right py-2 px-2 font-bold">Lost</th>
            <th className="text-right py-2 px-2 font-bold">Conv. Rate</th>
            <th className="text-right py-2 px-2 font-bold">Calls</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const isHighlighted = entry.userId === highlightUserId;
            return (
              <tr
                key={entry.userId}
                className={`border-b border-separator/50 transition-colors ${
                  isHighlighted ? "bg-accent/10 font-semibold" : "hover:bg-default/5"
                }`}
              >
                <td className="py-2 px-2 text-muted">{i + 1}</td>
                <td className="py-2 px-2 text-foreground">{entry.name}</td>
                <td className="py-2 px-2 text-right text-foreground">{entry.claimedLeads}</td>
                <td className="py-2 px-2 text-right text-success">{entry.conversions}</td>
                <td className="py-2 px-2 text-right text-danger">{entry.losses}</td>
                <td className="py-2 px-2 text-right">
                  <span className={`font-bold ${entry.conversionRate >= 50 ? "text-success" : entry.conversionRate > 0 ? "text-warning" : "text-muted"}`}>
                    {entry.conversionRate}%
                  </span>
                </td>
                <td className="py-2 px-2 text-right text-foreground">{entry.callNotes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
