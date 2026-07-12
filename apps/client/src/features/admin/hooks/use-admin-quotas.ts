import { useEffect, useState } from "react";
import type { Quota, UserSummary } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { todayInputValue, getErrorMessage } from "../../../lib/utils/format";

export function useAdminQuotas() {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [salesUsers, setSalesUsers] = useState<UserSummary[]>([]);
  const [date, setDate] = useState(todayInputValue());
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, danger } = useToast();

  async function loadQuotas() {
    try {
      setIsLoading(true);
      const [quotasData, usersData] = await Promise.all([
        adminApi.getQuotas({ date }),
        adminApi.getSalesUsers()
      ]);
      setQuotas(quotasData);
      setSalesUsers(usersData);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load quotas"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadQuotas();
  }, [date]);

  async function saveQuota(salesUserId: string, callsTarget: number, leadsTarget: number) {
    try {
      setSaving(true);
      await adminApi.saveQuota({
        salesUserId,
        date,
        callsTarget,
        leadsTarget
      });
      success("Quota target saved successfully");
      // Reload quotas to get updated database state
      const quotasData = await adminApi.getQuotas({ date });
      setQuotas(quotasData);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not save quota target"));
    } finally {
      setSaving(false);
    }
  }

  return {
    quotas,
    salesUsers,
    date,
    setDate,
    isLoading,
    saving,
    saveQuota,
    refresh: loadQuotas
  };
}
