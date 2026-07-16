import { useEffect, useState } from "react";
import type { AdminOverviewAggregates, AdminSummary, LeaderboardEntry } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useAdminOverview() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [aggregates, setAggregates] = useState<AdminOverviewAggregates | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function load() {
    try {
      setIsLoading(true);
      const [summaryData, aggregatesData, leaderboardData] = await Promise.all([
        adminApi.getSummary(),
        adminApi.getOverviewAggregates(),
        adminApi.getLeaderboard()
      ]);
      setSummary(summaryData);
      setAggregates(aggregatesData);
      setLeaderboard(leaderboardData);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not load admin overview"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { summary, aggregates, leaderboard, isLoading, refresh: load };
}
