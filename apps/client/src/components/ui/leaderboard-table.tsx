import { Badge } from "../arc/badge/badge";
import { SortableDataTable } from "../arc/sortable-data-table/sortable-data-table";
import { EmptyState } from "../arc/empty-state/empty-state";
import type { LeaderboardEntry } from "../../types";

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  highlightUserId?: string;
}

export function LeaderboardTable({ data, highlightUserId }: LeaderboardTableProps) {
  if (data.length === 0) {
    return <EmptyState title="No sales data yet" description="Sales results will appear here once the team starts working leads." />;
  }

  const ordered = [...data].sort((a, b) => b.conversions - a.conversions || b.conversionRate - a.conversionRate);

  return (
    <div className="crm-arc-table">
      <SortableDataTable
        rows={ordered.map((entry) => ({ ...entry }))}
        rowKey="userId"
        caption="Sales leaderboard"
        defaultSort={{ key: "conversions", direction: "desc" }}
        itemName={{ one: "representative", other: "representatives" }}
        columns={[
          { key: "name", label: "Representative", render: (value, row) => <span className="crm-leader-name">{String(value)}{row.userId === highlightUserId && <Badge tone="info" size="sm">You</Badge>}</span> },
          { key: "salesType", label: "Type", render: (value) => value === "EXTERNAL" ? "External" : "Internal" },
          { key: "claimedLeads", label: "Claimed", numeric: true },
          { key: "conversions", label: "Won", numeric: true },
          { key: "losses", label: "Lost", numeric: true },
          { key: "conversionRate", label: "Conversion rate", numeric: true, render: (value) => `${Number(value)}%` },
          { key: "callNotes", label: "Calls", numeric: true }
        ]}
      />
    </div>
  );
}
