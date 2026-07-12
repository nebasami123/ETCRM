interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDanger = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/50 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-sm rounded-xl border border-separator bg-overlay p-5 shadow-overlay animate-in fade-in scale-95 duration-200 ease-out-smooth">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="btn-interactive px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:bg-default"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`btn-interactive px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${
              isDanger
                ? "bg-danger hover:bg-danger/90"
                : "bg-accent hover:bg-accent/90"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
