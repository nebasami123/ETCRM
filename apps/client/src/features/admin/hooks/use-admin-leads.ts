import { useEffect, useState, useCallback } from "react";
import type {
  Lead,
  LeadFilters,
  LeadLocationFilterOptions,
  LeadPhase,
  Pagination,
  UserSummary,
  LeadFormData
} from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";
import { formatLeadImportSummary } from "../../../lib/utils/lead-import";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import { getCachedFilterOptions, peekFilterOptionsCache } from "../../../lib/filter-options-cache";

const FILTER_OPTIONS_KEY = "admin:lead-filter-options";

const initialLeadFilters: LeadFilters = {
  search: "",
  phase: "ALL",
  claimedById: "",
  createdById: "",
  region: "",
  subcity: "",
  sector: [],
  source: "ALL"
};

export function useAdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesUsers, setSalesUsers] = useState<UserSummary[]>([]);
  const cachedOptions = peekFilterOptionsCache<LeadLocationFilterOptions>(FILTER_OPTIONS_KEY);
  const [locationOptions, setLocationOptions] = useState<LeadLocationFilterOptions>(
    cachedOptions || { regions: [], subcities: [], sectors: [] }
  );
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(!cachedOptions);
  const [leadFilters, setLeadFilters] = useState<LeadFilters>(initialLeadFilters);
  const debouncedSearch = useDebouncedValue(leadFilters.search, 300);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { success, danger } = useToast();

  // Depend on debouncedSearch only — not leadFilters.search — so typing does not refetch every keystroke.
  const { phase, claimedById, createdById, region, subcity, sector, source } = leadFilters;
  const page = pagination.page;
  const pageSize = pagination.pageSize;

  const loadLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const [leadsData, usersData] = await Promise.all([
        adminApi.getLeads({
          search: debouncedSearch,
          phase,
          claimedById,
          createdById,
          region,
          subcity,
          sector,
          source: source === "ALL" ? "" : source,
          page,
          pageSize
        }),
        adminApi.getSalesUsers()
      ]);
      setLeads(leadsData.leads);
      setPagination(leadsData.pagination);
      setSalesUsers(usersData);
      setSelectedIds((prev) => prev.filter((id) => leadsData.leads.some((lead) => lead.id === id)));
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load leads"));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, phase, claimedById, createdById, region, subcity, sector, source, page, pageSize, danger]);

  useEffect(() => {
    let cancelled = false;
    const hasCache = Boolean(peekFilterOptionsCache(FILTER_OPTIONS_KEY));
    if (!hasCache) setIsFilterOptionsLoading(true);
    getCachedFilterOptions(FILTER_OPTIONS_KEY, () => adminApi.getLeadFilterOptions())
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

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const updateLeadFilter = (field: keyof LeadFilters, value: string | string[]) => {
    setLeadFilters((prev) => ({
      ...prev,
      [field]:
        field === "phase"
          ? (value as LeadPhase | "ALL")
          : field === "sector"
            ? (Array.isArray(value) ? value : value ? [value] : [])
            : (value as string)
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearLeadFilters = () => {
    setLeadFilters(initialLeadFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters =
    Boolean(leadFilters.search.trim()) ||
    leadFilters.phase !== "ALL" ||
    Boolean(leadFilters.claimedById) ||
    Boolean(leadFilters.createdById) ||
    Boolean(leadFilters.region) ||
    Boolean(leadFilters.subcity) ||
    leadFilters.sector.length > 0 ||
    (leadFilters.source !== "ALL" && Boolean(leadFilters.source));

  const toggleSelect = (leadId: string) => {
    setSelectedIds((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.length === leads.length ? [] : leads.map((lead) => lead.id)));
  };

  const assignLead = async (leadId: string, salesUserId: string | null) => {
    try {
      await adminApi.assignLead(leadId, salesUserId);
      success("Lead assignment updated successfully");
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not assign lead"));
    }
  };

  const bulkAssign = async (salesUserId: string | null) => {
    if (!selectedIds.length) return;
    try {
      const result = await adminApi.bulkAssignLeads(selectedIds, salesUserId);
      success(`Updated assignment on ${result.updated} lead(s)`);
      setSelectedIds([]);
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not bulk-assign leads"));
    }
  };

  const bulkPhase = async (phase: LeadPhase, creditedUserId?: string) => {
    if (!selectedIds.length) return;
    try {
      const result = await adminApi.bulkUpdatePhases(selectedIds, phase, creditedUserId);
      success(`Updated phase on ${result.updated} lead(s)`);
      setSelectedIds([]);
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not bulk-update phases"));
    }
  };

  const updateLeadPhase = async (leadId: string, phase: LeadPhase, creditedUserId?: string) => {
    try {
      await adminApi.updateLeadPhase(leadId, phase, creditedUserId);
      success(
        phase === "CLOSED_WON"
          ? "Lead won. Conversion credit recorded."
          : "Lead phase updated successfully"
      );
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not update phase"));
    }
  };

  const createLead = async (values: LeadFormData) => {
    try {
      const { assignedToId, ...payload } = values;
      const response = await adminApi.createLead({
        ...payload,
        appointmentDate: payload.appointmentDate || undefined
      });
      if (assignedToId) {
        const lead = (response as { lead?: { id: string } }).lead;
        if (lead?.id) await adminApi.assignLead(lead.id, assignedToId);
      }
      success("Lead created successfully");
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not create lead"));
      throw err;
    }
  };

  const updateLead = async (leadId: string, values: LeadFormData) => {
    try {
      const { assignedToId, ...payload } = values;
      await adminApi.updateLead(leadId, {
        ...payload,
        appointmentDate: payload.appointmentDate || undefined
      });
      if (assignedToId !== undefined) {
        await adminApi.assignLead(leadId, assignedToId || null);
      }
      success("Lead updated successfully");
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not update lead"));
      throw err;
    }
  };

  const uploadLeads = async (file: File) => {
    setIsUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await adminApi.uploadLeads(form);
      success(formatLeadImportSummary(data), 8000);
      await loadLeads();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not upload leads"));
    } finally {
      setIsUploading(false);
    }
  };

  return {
    leads,
    salesUsers,
    locationOptions,
    isFilterOptionsLoading,
    leadFilters,
    pagination,
    isLoading,
    isUploading,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    bulkAssign,
    bulkPhase,
    updateLeadFilter,
    clearLeadFilters,
    hasActiveFilters,
    setPage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    assignLead,
    updateLeadPhase,
    createLead,
    updateLead,
    uploadLeads,
    refresh: loadLeads
  };
}
