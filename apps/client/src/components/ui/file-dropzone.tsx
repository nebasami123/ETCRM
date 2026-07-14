import { useState, useRef } from "react";
import { Upload, FileText, RefreshCw } from "lucide-react";
import { Card } from "./card";

interface FileDropzoneProps {
  title: string;
  description: string;
  isUploading: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: (file: File) => void | Promise<void>;
}

export function FileDropzone({
  title,
  description,
  isUploading,
  onFileChange,
  onUpload
}: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      onFileChange(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileChange(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const triggerFileInput = () => {
    inputRef.current?.click();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedFile) void onUpload(selectedFile);
  };

  return (
    <Card className="rounded-xl border border-separator bg-surface p-5 shadow-surface">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>

      <form onSubmit={handleSubmit} className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          className="hidden"
        />

        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all duration-200 ${
            dragActive
              ? "border-accent bg-accent/5 scale-[1.01]"
              : selectedFile
              ? "border-accent/30 bg-accent/2"
              : "border-separator hover:border-accent/40 hover:bg-default/50"
          }`}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
              <FileText className="h-10 w-10 text-accent mb-2" />
              <p className="text-xs font-semibold text-foreground max-w-50 truncate">
                {selectedFile.name}
              </p>
              <p className="text-[10px] text-muted mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Upload className="h-10 w-10 text-muted mb-2 transition-transform duration-250 group-hover:-translate-y-0.5" />
              <p className="text-xs font-semibold text-foreground">
                Drag & drop or <span className="text-accent hover:underline">browse</span>
              </p>
              <p className="text-[10px] text-muted mt-1">Supports CSV, XLS, XLSX up to 10MB</p>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 mt-4 justify-end">
            <button
              type="button"
              onClick={clearFile}
              disabled={isUploading}
              className="btn-interactive px-3 py-1 text-xs border border-border bg-surface text-foreground rounded-lg hover:bg-default"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="btn-interactive px-3 py-1 text-xs bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {isUploading ? (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin shrink-0 mr-1" />
                  Uploading...
                </span>
              ) : (
                "Import leads"
              )}
            </button>
          </div>
        )}
      </form>
    </Card>
  );
}
