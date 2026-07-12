import { useEffect, useState } from "react";
import type { AdminSummary } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useAdminSummary() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function loadSummary() {
    try {
      setIsLoading(true);
      const data = await adminApi.getSummary();
      setSummary(data);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not load admin summary"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  return { summary, isLoading, refresh: loadSummary };
}
