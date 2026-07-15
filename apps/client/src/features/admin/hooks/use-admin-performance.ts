import { useEffect, useState, useCallback } from "react";
import type { LeaderboardEntry, AgentPerformanceMetrics } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useAdminPerformance() {
  const getPastDateString = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const [from, setFrom] = useState(() => getPastDateString(7));
  const [to, setTo] = useState(() => getPastDateString(0));
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [metrics, setMetrics] = useState<AgentPerformanceMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [leaderboardData, metricsData] = await Promise.all([
        adminApi.getLeaderboard(),
        adminApi.getPerformanceMetrics({ from, to })
      ]);
      setLeaderboard(leaderboardData);
      setMetrics(metricsData);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load performance metrics"));
    } finally {
      setIsLoading(false);
    }
  }, [from, to, danger]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setPresetRange = (days: number) => {
    setFrom(getPastDateString(days));
    setTo(getPastDateString(0));
  };

  return {
    from,
    to,
    setFrom,
    setTo,
    setPresetRange,
    leaderboard,
    metrics,
    isLoading,
    refresh: loadData
  };
}
