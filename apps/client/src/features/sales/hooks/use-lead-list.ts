import { useEffect, useState } from "react";
import type { Lead, LeadPhase, Pagination } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";

export function useLeadList(scope: "mine" | "all" = "all") {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState<LeadPhase | "ALL">("ALL");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function loadLeads() {
    try {
      setIsLoading(true);
      const leadsData = await salesApi.getLeads({ scope, search, phase, page: pagination.page, pageSize: pagination.pageSize });
      setLeads(leadsData.leads);
      setPagination(leadsData.pagination);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load lead queue"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [scope, search, phase, pagination.page, pagination.pageSize]);

  return {
    leads,
    todoCount: 0,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    phase,
    setPhase: (value: LeadPhase | "ALL") => {
      setPhase(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    pagination,
    setPage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    isLoading,
    refresh: loadLeads
  };
}
