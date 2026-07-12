import { useEffect, useState, useMemo } from "react";
import type { Lead } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useLeadList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [todoLeads, setTodoLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function loadLeads() {
    try {
      setIsLoading(true);
      const [leadsData, dashboardData] = await Promise.all([
        salesApi.getLeads(),
        salesApi.getDashboard().catch(() => null)
      ]);
      setLeads(leadsData);
      if (dashboardData) {
        setTodoLeads(dashboardData.todoLeads);
      }
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load lead queue"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const activeList = useMemo(() => {
    return todoLeads.length > 0 ? todoLeads : leads;
  }, [todoLeads, leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeList;
    return activeList.filter((lead) => {
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
  }, [activeList, search]);

  return {
    leads: filteredLeads,
    todoCount: todoLeads.length,
    search,
    setSearch,
    isLoading,
    refresh: loadLeads
  };
}
