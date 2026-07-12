import { useState } from "react";
import { useToast } from "../../../hooks/use-toast";
import { salesApi } from "../api";
import { getErrorMessage } from "../../../lib/utils/format";
import type { LeadFormData } from "../../../types";
import { LeadForm } from "../../../components/forms/lead-form";
import { FileDropzone } from "../../../components/ui/file-dropzone";

export function SalesNewLead() {
  const { success, danger } = useToast();
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleCreateLead = async (values: LeadFormData) => {
    try {
      setSaving(true);
      const payload = {
        ...values,
        appointmentDate: values.appointmentDate ? new Date(values.appointmentDate).toISOString() : null
      };
      await salesApi.createLead(payload);
      success("Lead created and claimed automatically");
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Failed to create lead"));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLeads = async (file: File) => {
    setIsUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await salesApi.uploadLeads(form);
      const skippedText = data.skipped ? ` Skipped ${data.skipped}.` : "";
      const reasonText = data.skippedRows?.length
        ? ` First issue: row ${data.skippedRows[0].row} - ${data.skippedRows[0].reason}.`
        : "";
      success(`Imported ${data.imported} leads and assigned them to you.${skippedText}${reasonText}`);
    } catch (err: unknown) {
      danger(getErrorMessage(err, "Could not upload leads"));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">Acquire & Import Leads</h2>
        <p className="text-xs text-muted mt-1">Create single contacts or bulk import databases directly to your active queue.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Single Lead Form */}
        <LeadForm
          title="Manual Lead Registration"
          onSubmit={handleCreateLead}
          isLoading={saving}
          showAssignment={false}
        />

        {/* Bulk Uploader */}
        <div className="h-fit">
          <FileDropzone
            title="Bulk Leads Importer (CSV)"
            description="Drag and drop or browse for lead contacts in CSV format. Uploaded leads will be assigned to you automatically."
            isUploading={isUploading}
            onFileChange={() => {}}
            onUpload={async (e) => {
              e.preventDefault();
              const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
              if (fileInput?.files?.[0]) {
                await handleUploadLeads(fileInput.files[0]);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
export default SalesNewLead;
