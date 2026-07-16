import { useEffect, useState } from "react";
import type { Lead, LeadPhase, Pagination } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";

export function useLeadList(scope: "mine" | "all" = "all") {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [phase, setPhase] = useState<LeadPhase | "ALL">("ALL");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function loadLeads() {
    try {
      setIsLoading(true);
      const leadsData = await salesApi.getLeads({
        scope,
        search: debouncedSearch,
        phase,
        page: pagination.page,
        pageSize: pagination.pageSize
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload on filter/page changes
  }, [scope, debouncedSearch, phase, pagination.page, pagination.pageSize]);

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
