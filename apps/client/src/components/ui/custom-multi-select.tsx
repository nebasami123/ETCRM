import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
  emptyLabel?: string;
}

export function CustomMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  loading = false,
  className = "",
  triggerClassName = "",
  size = "md",
  ariaLabel,
  emptyLabel = "Any"
}: CustomMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = value ?? [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const clear = () => onChange([]);

  const triggerText = (() => {
    if (!selected.length) return emptyLabel || placeholder;
    if (selected.length === 1) {
      const match = options.find((opt) => opt.value === selected[0]);
      return match?.label || selected[0];
    }
    return `${selected.length} selected`;
  })();

  const sizeClasses = {
    sm: "px-2 py-1 text-[11px] h-7 min-w-[120px]",
    md: "px-3 py-2 text-xs h-9 w-full"
  };

  const buttonStyleClass =
    triggerClassName || "border-field-border bg-field-background text-field-foreground focus:border-accent";

  return (
    <div ref={containerRef} className={`relative inline-block ${size === "md" ? "w-full" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setIsOpen((open) => !open);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        className={`flex items-center justify-between rounded-lg border focus:outline-none disabled:opacity-50 text-left cursor-pointer transition-colors duration-160 ${buttonStyleClass} ${sizeClasses[size]}`}
      >
        <span className="truncate mr-2">{triggerText}</span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-muted shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-separator bg-overlay p-1 shadow-overlay backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-2.5 py-4 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading options…
            </div>
          ) : options.length === 0 ? (
            <div className="px-2.5 py-4 text-center text-xs text-muted">No options</div>
          ) : (
            <>
              <button
                type="button"
                onClick={clear}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors duration-100 cursor-pointer ${
                  !selected.length
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-foreground hover:bg-default/20"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
                    !selected.length ? "border-accent bg-accent text-accent-foreground" : "border-field-border bg-field-background"
                  }`}
                >
                  {!selected.length ? (
                    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 stroke-[3.5]" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : null}
                </span>
                <span className="truncate">{emptyLabel}</span>
              </button>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={`${opt.value}::${opt.label}`}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors duration-100 cursor-pointer ${
                      isSelected
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-foreground hover:bg-default/20"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
                        isSelected ? "border-accent bg-accent text-accent-foreground" : "border-field-border bg-field-background"
                      }`}
                    >
                      {isSelected ? (
                        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 stroke-[3.5]" fill="none" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
