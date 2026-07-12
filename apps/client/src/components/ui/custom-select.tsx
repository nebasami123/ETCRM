import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
  triggerClassName = "",
  size = "md",
  ariaLabel
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-[11px] h-7 min-w-[120px]",
    md: "px-3 py-2 text-xs h-9 w-full"
  };

  const buttonStyleClass = triggerClassName || "border-field-border bg-field-background text-field-foreground focus:border-accent";

  return (
    <div ref={containerRef} className={`relative inline-block ${size === "md" ? "w-full" : ""} ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`flex items-center justify-between rounded-lg border focus:outline-none disabled:opacity-50 text-left cursor-pointer transition-colors duration-160 ${buttonStyleClass} ${sizeClasses[size]}`}
      >

        <span className="truncate mr-2">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-separator bg-overlay p-1 shadow-overlay backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors duration-100 cursor-pointer ${
                opt.value === value
                  ? "bg-accent/10 text-accent font-semibold"
                  : "text-foreground hover:bg-default/20"
              }`}
            >
              <span className="truncate mr-2">{opt.label}</span>
              {opt.value === value && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
