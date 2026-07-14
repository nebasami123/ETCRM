import { useEffect, useState, useMemo } from "react";
import type { Lead } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useLeadList(scope: "mine" | "all" = "all") {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function loadLeads() {
    try {
      setIsLoading(true);
      const leadsData = await salesApi.getLeads(scope);
      setLeads(leadsData);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load lead queue"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [scope]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leads;
    return leads.filter((lead) => {
      return [
        lead.fullName,
        lead.phoneNumber,
        lead.email,
        lead.businessName,
        lead.licenceNumber,
        lead.businessRegion,
        lead.businessWoreda
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(query));
    });
  }, [leads, search]);

  return {
    leads: filteredLeads,
    todoCount: 0,
    search,
    setSearch,
    isLoading,
    refresh: loadLeads
  };
}
