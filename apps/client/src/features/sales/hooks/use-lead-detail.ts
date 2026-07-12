import { useEffect, useState } from "react";
import type { Lead, LeadPhase } from "../../../types";
import { salesApi } from "../api";
import { useToast } from "../../../hooks/use-toast";
import { toDateTimeLocalValue, getErrorMessage } from "../../../lib/utils/format";

export function useLeadDetail(leadId: string | null) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { success, danger } = useToast();

  // Form inputs matching details panel
  const [phase, setPhase] = useState<LeadPhase>("NEW");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [note, setNote] = useState("");

  async function loadLeadDetail() {
    if (!leadId) {
      setLead(null);
      return;
    }
    try {
      setIsLoading(true);
      const data = await salesApi.getLead(leadId);
      setLead(data);
      setPhase(data.phase);
      setAppointmentDate(toDateTimeLocalValue(data.appointmentDate));
      setFollowUpDate(toDateTimeLocalValue(data.nextFollowUpAt));
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to load lead details"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLeadDetail();
  }, [leadId]);

  const phaseChanged = lead ? phase !== lead.phase : false;
  const apptChanged = lead ? appointmentDate !== toDateTimeLocalValue(lead.appointmentDate) : false;
  const followChanged = lead ? followUpDate !== toDateTimeLocalValue(lead.nextFollowUpAt) : false;
  const noteAdded = note.trim().length > 0;

  const apptValid = !apptChanged || !!appointmentDate;
  const followValid = !followChanged || !!followUpDate;

  const canSave = (phaseChanged || apptChanged || followChanged || noteAdded) && apptValid && followValid && !saving;

  const saveAllChanges = async () => {
    if (!lead) return;
    try {
      setSaving(true);
      const promises = [];

      if (phaseChanged) {
        promises.push(salesApi.updatePhase(lead.id, phase));
      }
      if (apptChanged) {
        const dateVal = appointmentDate ? new Date(appointmentDate).toISOString() : null;
        promises.push(salesApi.updateAppointment(lead.id, dateVal));
      }
      if (followChanged) {
        const dateVal = followUpDate ? new Date(followUpDate).toISOString() : null;
        promises.push(salesApi.updateFollowUp(lead.id, dateVal));
      }
      if (noteAdded) {
        promises.push(salesApi.addNote(lead.id, note));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        success("Lead updates saved successfully");
        setNote(""); // clear note
        await loadLeadDetail();
      }
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to save some updates"));
    } finally {
      setSaving(false);
    }
  };

  const claimLead = async () => {
    if (!lead) return;
    try {
      setSaving(true);
      const updated = await salesApi.claimLead(lead.id);
      setLead(updated);
      success("Lead claimed successfully");
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not claim lead"));
    } finally {
      setSaving(false);
    }
  };

  const requestTransfer = async (reason: string) => {
    if (!lead || !reason.trim()) return;
    try {
      setSaving(true);
      await salesApi.requestTransfer(lead.id, reason);
      success("Ownership transfer request submitted for Admin review");
      await loadLeadDetail();
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not submit transfer request"));
    } finally {
      setSaving(false);
    }
  };

  return {
    lead,
    isLoading,
    saving,
    phase,
    setPhase,
    appointmentDate,
    setAppointmentDate,
    followUpDate,
    setFollowUpDate,
    note,
    setNote,
    canSave,
    saveAllChanges,
    claimLead,
    requestTransfer,
    refresh: loadLeadDetail
  };
}

