import type { UploadResult } from "../../types";

export function formatLeadImportSummary(result: UploadResult, assignedToUploader = false) {
  const importedText = `Imported ${result.imported} leads${assignedToUploader ? " and assigned them to you" : ""}.`;
  if (!result.skipped) return importedText;

  const reasonSummary = result.skippedByReason?.length
    ? result.skippedByReason
    : [{ reason: "Skipped", count: result.skipped }];
  const reasons = reasonSummary.map(({ reason, count }) => `• ${count} — ${reason}`).join("\n");
  return `${importedText}\nSkipped ${result.skipped}:\n${reasons}`;
}
