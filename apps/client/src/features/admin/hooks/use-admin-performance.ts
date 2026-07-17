import { useEffect, useState, useCallback } from "react";
import type { LeaderboardEntry, AgentPerformanceMetrics, CampaignAnalyticsRow, Campaign } from "../../../types";
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
  const [campaignId, setCampaignId] = useState("");

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [metrics, setMetrics] = useState<AgentPerformanceMetrics[]>([]);
  const [campaignAnalytics, setCampaignAnalytics] = useState<CampaignAnalyticsRow[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const { danger } = useToast();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [leaderboardData, metricsData, campaigns] = await Promise.all([
        adminApi.getLeaderboard(),
        adminApi.getPerformanceMetrics({ from, to }),
        adminApi.getCampaignAnalytics().catch(() => [] as CampaignAnalyticsRow[])
      ]);
      setLeaderboard(leaderboardData);
      setMetrics(metricsData);
      setCampaignAnalytics(campaigns);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load performance"));
    } finally {
      setIsLoading(false);
    }
  }, [from, to, danger]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!campaignId) {
      setSelectedCampaign(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setIsCampaignLoading(true);
        const campaign = await adminApi.getCampaign(campaignId);
        if (!cancelled) setSelectedCampaign(campaign);
      } catch (err: unknown) {
        if (!cancelled) {
          setSelectedCampaign(null);
          danger(getErrorMessage(err, "Failed to load campaign stats"));
        }
      } finally {
        if (!cancelled) setIsCampaignLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId, danger]);

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
    campaignId,
    setCampaignId,
    leaderboard,
    metrics,
    campaignAnalytics,
    selectedCampaign,
    isLoading,
    isCampaignLoading,
    refresh: loadData
  };
}
