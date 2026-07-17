import { useEffect, useState } from "react";
import type { Lead, LeadLocationFilterOptions, LeadPhase, LeadSource, Pagination } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import { getCachedFilterOptions, peekFilterOptionsCache } from "../../../lib/filter-options-cache";

const FILTER_OPTIONS_KEY = "sales:lead-filter-options";

export function useLeadList(scope: "mine" | "all" = "all", campaignId = "") {
  const cachedOptions = peekFilterOptionsCache<LeadLocationFilterOptions>(FILTER_OPTIONS_KEY);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [locationOptions, setLocationOptions] = useState<LeadLocationFilterOptions>(
    cachedOptions || { regions: [], subcities: [], sectors: [] }
  );
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(!cachedOptions);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [phase, setPhase] = useState<LeadPhase | "ALL">("ALL");
  const [region, setRegion] = useState("");
  const [subcity, setSubcity] = useState("");
  const [sector, setSector] = useState<string[]>([]);
  const [source, setSource] = useState<LeadSource | "ALL">("ALL");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { danger } = useToast();

  async function loadLeads() {
    try {
      setIsLoading(true);
      const leadsData = await salesApi.getLeads({
        scope: campaignId ? "mine" : scope,
        search: debouncedSearch,
        phase,
        region,
        subcity,
        sector,
        source: source === "ALL" ? "" : source,
        campaignId: campaignId || undefined,
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
  }, [scope, campaignId, debouncedSearch, phase, region, subcity, sector, source, pagination.page, pagination.pageSize]);

  useEffect(() => {
    let cancelled = false;
    const hasCache = Boolean(peekFilterOptionsCache(FILTER_OPTIONS_KEY));
    if (!hasCache) setIsFilterOptionsLoading(true);
    getCachedFilterOptions(FILTER_OPTIONS_KEY, () => salesApi.getLeadFilterOptions())
      .then((options) => {
        if (!cancelled) setLocationOptions(options);
      })
      .catch(() => {
        if (!cancelled && !hasCache) setLocationOptions({ regions: [], subcities: [], sectors: [] });
      })
      .finally(() => {
        if (!cancelled) setIsFilterOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearFilters = () => {
    setSearch("");
    setPhase("ALL");
    setRegion("");
    setSubcity("");
    setSector([]);
    setSource("ALL");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    phase !== "ALL" ||
    Boolean(region) ||
    Boolean(subcity) ||
    sector.length > 0 ||
    source !== "ALL";

  return {
    leads,
    locationOptions,
    isFilterOptionsLoading,
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
    region,
    setRegion: (value: string) => {
      setRegion(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    subcity,
    setSubcity: (value: string) => {
      setSubcity(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    sector,
    setSector: (value: string[]) => {
      setSector(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    source,
    setSource: (value: LeadSource | "ALL") => {
      setSource(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilters,
    hasActiveFilters,
    pagination,
    setPage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    isLoading,
    refresh: loadLeads
  };
}
