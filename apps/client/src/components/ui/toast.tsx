import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { toastStore, type ToastItem, type ToastType } from "../../hooks/use-toast";

const icons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info
};

const bgColors: Record<ToastType, string> = {
  success: "bg-success/10 border-success/20 text-success",
  warning: "bg-warning/10 border-warning/20 text-warning",
  danger: "bg-danger/10 border-danger/20 text-danger",
  info: "bg-accent/10 border-accent/20 text-accent"
};

const iconColors: Record<ToastType, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-accent"
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastStore.subscribe((newToasts) => {
      setToasts(newToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-lg border p-4 shadow-overlay backdrop-blur-md transition-all duration-300 ease-out-smooth animate-in slide-in-from-bottom-5 ${bgColors[toast.type]}`}
            role="alert"
          >
            <Icon className={`h-5 w-5 shrink-0 ${iconColors[toast.type]}`} />
            <div className="max-h-48 flex-1 overflow-y-auto whitespace-pre-line text-sm font-medium" data-scrollbar="thin">{toast.message}</div>
            <button
              onClick={() => toastStore.dismiss(toast.id)}
              className="rounded-md p-0.5 text-foreground/50 hover:bg-foreground/5 hover:text-foreground transition-colors"
              aria-label="Dismiss toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
