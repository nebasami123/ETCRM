import { useMemo } from "react";

// Let's use a custom event emitter for simple, dependency-free global toast state!
// Or we can just use standard state with a listener.

export type ToastType = "success" | "warning" | "danger" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;
const listeners = new Set<Listener>();
let toasts: ToastItem[] = [];

function emit() {
  listeners.forEach((listener) => listener([...toasts]));
}

export const toastStore = {
  add(message: string, type: ToastType = "info", duration = 3000) {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastItem = { id, message, type, duration };
    toasts = [...toasts, toast];
    emit();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener([...toasts]);
    return () => {
      listeners.delete(listener);
    };
  }
};

export function useToast() {
  return useMemo(() => ({
    toast: (message: string, type: ToastType = "info", duration?: number) => toastStore.add(message, type, duration),
    success: (message: string, duration?: number) => toastStore.add(message, "success", duration),
    warning: (message: string, duration?: number) => toastStore.add(message, "warning", duration),
    danger: (message: string, duration?: number) => toastStore.add(message, "danger", duration),
    info: (message: string, duration?: number) => toastStore.add(message, "info", duration),
    dismiss: (id: string) => toastStore.dismiss(id)
  }), []);
}

