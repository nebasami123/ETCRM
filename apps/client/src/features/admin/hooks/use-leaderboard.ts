import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  useEffect(() => {
    setIsLoading(true);
    adminApi.getLeaderboard()
      .then(setLeaderboard)
      .catch((err: unknown) => danger(getErrorMessage(err, "Failed to load leaderboard")))
      .finally(() => setIsLoading(false));
  }, []);

  return { leaderboard, isLoading };
}
