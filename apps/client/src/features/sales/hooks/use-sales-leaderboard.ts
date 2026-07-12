import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useSalesLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  useEffect(() => {
    setIsLoading(true);
    salesApi.getLeaderboard()
      .then((data) => { setLeaderboard(data.leaderboard); setMyStats(data.myStats); })
      .catch((err: unknown) => danger(getErrorMessage(err, "Failed to load leaderboard")))
      .finally(() => setIsLoading(false));
  }, []);

  return { leaderboard, myStats, isLoading };
}
