import { useState } from "react";
import type { UserSummary, LeadFormData } from "../../types";
import { leadFormSchema } from "../../lib/validations/leads";
import { leadSourceOptions, normalizeLeadSource } from "../../lib/constants/lead-sources";
import { FormField } from "./form-field";
import { Card } from "../ui/card";
import { CustomSelect } from "../ui/custom-select";

interface LeadFormProps {
  title?: string;
  initialValues?: {
    fullName: string;
    phoneNumber: string;
    email: string;
    leadSource?: string;
    leadSourceDetail?: string | null;
    appointmentDate?: string;
    assignedToId?: string;
  };
  salesUsers?: UserSummary[];
  onSubmit: (values: LeadFormData) => Promise<void>;
  isLoading?: boolean;
  showAssignment?: boolean;
}

export function LeadForm({
  title = "Create New Lead",
  initialValues,
  salesUsers = [],
  onSubmit,
  isLoading = false,
  showAssignment = false
}: LeadFormProps) {
  const [fullName, setFullName] = useState(initialValues?.fullName || "");
  const [phoneNumber, setPhoneNumber] = useState(initialValues?.phoneNumber || "");
  const [email, setEmail] = useState(initialValues?.email || "");
  const initialLeadSource = normalizeLeadSource(initialValues?.leadSource);
  const [leadSource, setLeadSource] = useState(initialLeadSource.source);
  const [leadSourceDetail, setLeadSourceDetail] = useState(initialLeadSource.source === "Other" ? (initialValues?.leadSourceDetail || initialLeadSource.detail) : "");
  const [appointmentDate, setAppointmentDate] = useState(initialValues?.appointmentDate || "");
  const [assignedToId, setAssignedToId] = useState(initialValues?.assignedToId || "");
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData = {
      fullName,
      phoneNumber,
      email,
      leadSource,
      leadSourceDetail: leadSource === "Other" ? leadSourceDetail.trim() : "",
      appointmentDate: appointmentDate || null,
      ...(showAssignment ? { assignedToId } : {})
    };

    const result = leadFormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form if it is a creation form (i.e. not an edit form)
      if (!initialValues) {
        setFullName("");
        setPhoneNumber("");
        setEmail("");
        setLeadSource("");
        setLeadSourceDetail("");
        setAppointmentDate("");
        setAssignedToId("");
      }
    } catch {
      // API error handled by parent page/hook
    }
  };

  return (
    <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      
      <form noValidate onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Full Name" error={errors.fullName} required>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
            placeholder="John Doe"
          />
        </FormField>

        <FormField label="Phone Number" error={errors.phoneNumber} required>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none font-mono"
            placeholder="+251..."
          />
        </FormField>

        <FormField label="Email Address" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
            placeholder="john@example.com"
          />
        </FormField>

        <FormField label="Lead Source" error={errors.leadSource}>
          <CustomSelect
            value={leadSource}
            onChange={(value) => {
              setLeadSource(value);
              if (value !== "Other") setLeadSourceDetail("");
            }}
            options={leadSourceOptions}
            placeholder="Select lead source..."
            searchable
            ariaLabel="Lead source"
          />
        </FormField>

        {leadSource === "Other" ? (
          <FormField label="Please specify" error={errors.leadSourceDetail}>
            <input
              type="text"
              value={leadSourceDetail}
              onChange={(event) => setLeadSourceDetail(event.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
              placeholder="Describe where this lead came from"
            />
          </FormField>
        ) : null}

        <FormField label="Initial Appointment" error={errors.appointmentDate}>
          <input
            type="datetime-local"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
            className="w-full rounded-lg border border-field-border bg-field-background px-3 py-2 text-xs text-field-foreground placeholder:text-field-placeholder focus:border-accent focus:outline-none"
          />
        </FormField>

        {showAssignment && (
          <FormField label="Assign Sales Agent" error={errors.assignedToId} className="sm:col-span-2">
            <CustomSelect
              value={assignedToId}
              onChange={setAssignedToId}
              options={[
                { value: "", label: "Unassigned (Claim Queue)" },
                ...salesUsers.map((user) => ({ value: user.id, label: user.name }))
              ]}
              placeholder="Unassigned (Claim Queue)"
            />
          </FormField>
        )}

        <div className="flex justify-end gap-2.5 mt-2 sm:col-span-2">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-interactive w-full sm:w-auto px-5 py-2 text-xs font-bold bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : initialValues ? "Update Lead" : "Create Lead"}
          </button>
        </div>
      </form>
    </Card>
  );
}
