import { Upload } from "lucide-react";
import type { FormEvent } from "react";

interface LeadUploadProps {
  title: string;
  description: string;
  isUploading?: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function LeadUpload({ title, description, isUploading = false, onFileChange, onUpload }: LeadUploadProps) {
  return (
    <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      <form onSubmit={onUpload} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="w-full rounded border border-line px-3 py-2 text-sm"
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded bg-forest px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isUploading}
        >
          <Upload size={18} />
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </section>
  );
}
