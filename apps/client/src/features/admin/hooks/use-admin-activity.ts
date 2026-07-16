import { useEffect, useState } from "react";
import type { Activity } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";

export function useAdminActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { success, danger } = useToast();

  async function loadActivity() {
    try {
      setIsLoading(true);
      const data = await adminApi.getActivity({ limit: 40 });
      setActivities(data);
    } catch (err: unknown) {
      danger(err instanceof Error ? err.message : "Failed to load activities");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  async function downloadReport(range?: { from?: string; to?: string }) {
    try {
      setExporting(true);
      const response = await adminApi.downloadReport(range);
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `etcrm-performance-report-${range?.from || "all"}-${range?.to || "now"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      success("Report CSV downloaded successfully");
    } catch (err: unknown) {
      danger(err instanceof Error ? err.message : "Could not download performance report");
    } finally {
      setExporting(false);
    }
  }

  return {
    activities,
    isLoading,
    exporting,
    downloadReport,
    refresh: loadActivity
  };
}
