import { useEffect, useState } from "react";
import type { UserSummary, SalesUserForm } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useAdminTeam() {
  const [team, setTeam] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, danger } = useToast();

  async function loadTeam() {
    try {
      setIsLoading(true);
      const users = await adminApi.getAllUsers();
      setTeam(users);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load team users"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, []);

  async function createSalesUser(payload: SalesUserForm) {
    try {
      setSaving(true);
      await adminApi.createSalesUser(payload);
      success(`Sales user "${payload.name}" created successfully`);
      await loadTeam();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not create sales user"));
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(userId: string, newPassword: string) {
    try {
      setSaving(true);
      await adminApi.resetSalesUserPassword(userId, newPassword);
      success("Sales user password reset and active sessions revoked");
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not reset password"));
    } finally {
      setSaving(false);
    }
  }

  return {
    team,
    isLoading,
    saving,
    createSalesUser,
    resetPassword,
    refresh: loadTeam
  };
}
