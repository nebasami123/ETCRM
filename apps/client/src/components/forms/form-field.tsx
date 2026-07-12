import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  id?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, error, id, required = false, className = "", children }: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <label htmlFor={id} className="text-xs font-bold text-foreground">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <div className="relative w-full">
        {children}
      </div>
      {error && (
        <p className="text-[10px] text-danger font-semibold tracking-normal mt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {error}
        </p>
      )}
    </div>
  );
}
