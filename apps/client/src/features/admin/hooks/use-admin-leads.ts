import { useEffect, useState, useCallback } from "react";
import type { Lead, LeadFilters, LeadPhase, Pagination, UserSummary, LeadFormData } from "../../../types";
import { adminApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { getErrorMessage } from "../../../lib/utils/format";
import { formatLeadImportSummary } from "../../../lib/utils/lead-import";

const initialLeadFilters: LeadFilters = {
  search: "",
  phase: "ALL",
  claimedById: "",
  createdById: ""
};

export function useAdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salesUsers, setSalesUsers] = useState<UserSummary[]>([]);
  const [leadFilters, setLeadFilters] = useState<LeadFilters>(initialLeadFilters);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { success, danger } = useToast();

  const loadLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      const [leadsData, usersData] = await Promise.all([
        adminApi.getLeads({ ...leadFilters, page: pagination.page, pageSize: pagination.pageSize }),
        adminApi.getSalesUsers()
      ]);
      setLeads(leadsData.leads);
      setPagination(leadsData.pagination);
      setSalesUsers(usersData);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load leads"));
    } finally {
      setIsLoading(false);
    }
  }, [leadFilters, pagination.page, pagination.pageSize, danger]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const updateLeadFilter = (field: keyof LeadFilters, value: string) => {
    setLeadFilters((prev) => ({
      ...prev,
      [field]: field === "phase" ? (value as LeadPhase | "ALL") : value
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
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
      if (assignedToId) {
        await adminApi.assignLead(leadId, assignedToId);
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
    leadFilters,
    pagination,
    isLoading,
    isUploading,
    updateLeadFilter,
    setPage: (page: number) => setPagination((prev) => ({ ...prev, page })),
    assignLead,
    updateLeadPhase,
    createLead,
    updateLead,
    uploadLeads,
    refresh: loadLeads
  };
};
