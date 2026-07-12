import { useEffect, useState } from "react";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export interface ClaimRequest {
  id: string;
  leadId: string;
  lead: {
    id: string;
    fullName: string;
    phoneNumber: string;
  };
  requestedBy: {
    id: string;
    name: string;
  };
  reason: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export function useAdminTransfers() {
  const [requests, setRequests] = useState<ClaimRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { success, danger } = useToast();

  async function loadRequests() {
    try {
      setIsLoading(true);
      const data = await adminApi.getTransferRequests("PENDING");
      setRequests(data);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load claim transfers"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function resolveRequest(requestId: string, approve: boolean) {
    try {
      await adminApi.resolveTransferRequest(requestId, approve);
      success(approve ? "Claim transfer approved" : "Claim transfer rejected");
      await loadRequests();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not resolve claim transfer request"));
    }
  }

  return {
    requests,
    isLoading,
    resolveRequest,
    refresh: loadRequests
  };
}
