import { useEffect, useState } from "react";
import type { SalesDashboardData } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useSalesOverview() {
  const [dashboard, setDashboard] = useState<SalesDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { danger } = useToast();

  async function loadDashboard() {
    try {
      setIsLoading(true);
      setLoadError(false);
      const data = await salesApi.getDashboard();
      setDashboard(data);
    } catch (err: unknown) {
      setLoadError(true);
      danger(getErrorMessage(err, "Failed to load sales dashboard"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return {
    dashboard,
    isLoading,
    loadError,
    refresh: loadDashboard
  };
}
