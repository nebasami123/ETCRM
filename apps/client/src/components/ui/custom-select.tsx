import { useState, useRef, useEffect, useId, type KeyboardEvent } from "react";
import { ChevronDown, Check, Loader2, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
  searchable?: boolean;
}

export function CustomSelect({
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
  searchable = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selectedOption = options.find((opt) => opt.value === (value ?? ""));
  const filteredOptions = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => option.label.toLocaleLowerCase().includes(searchTerm.trim().toLocaleLowerCase()));

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

  useEffect(() => {
    if (isOpen && searchable) {
      setSearchTerm("");
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  const firstEnabledIndex = () => options.findIndex((option) => !option.disabled);
  const selectedIndex = options.findIndex((option) => option.value === (value ?? ""));

  const openAt = (index = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex()) => {
    setActiveIndex(index >= 0 && !options[index]?.disabled ? index : firstEnabledIndex());
    setIsOpen(true);
  };

  const handleToggle = () => {
    if (!disabled) {
      if (isOpen) setIsOpen(false);
      else openAt();
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm("");
    triggerRef.current?.focus();
  };

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openAt();
        return;
      }
      const direction = event.key === "ArrowDown" ? 1 : -1;
      let nextIndex = activeIndex;
      for (let count = 0; count < options.length; count += 1) {
        nextIndex = (nextIndex + direction + options.length) % options.length;
        if (!options[nextIndex]?.disabled) {
          setActiveIndex(nextIndex);
          break;
        }
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const indexes = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
      if (indexes.length) setActiveIndex(event.key === "Home" ? indexes[0] : indexes[indexes.length - 1]);
      return;
    }
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      setSearchTerm("");
      triggerRef.current?.focus();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && isOpen) {
      event.preventDefault();
      const activeOption = options[activeIndex];
      if (activeOption && !activeOption.disabled) handleSelect(activeOption.value);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openAt();
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setSearchTerm("");
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const enabled = filteredOptions.filter(({ option }) => !option.disabled);
      if (!enabled.length) return;
      const activePosition = enabled.findIndex(({ index }) => index === activeIndex);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextPosition = activePosition < 0
        ? (direction === 1 ? 0 : enabled.length - 1)
        : (activePosition + direction + enabled.length) % enabled.length;
      const nextIndex = enabled[nextPosition].index;
      setActiveIndex(nextIndex);
      document.getElementById(`${listboxId}-option-${nextIndex}`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const activeOption = options[activeIndex];
      if (activeOption && !activeOption.disabled && filteredOptions.some(({ index }) => index === activeIndex)) {
        handleSelect(activeOption.value);
      }
    }
  }

  const sizeClasses = {
    sm: "px-2 py-1 text-[11px] h-7 min-w-[120px]",
    md: "px-3 py-2 text-sm h-10 w-full"
  };

  const buttonStyleClass =
    triggerClassName || "border-field-border bg-field-background text-field-foreground focus:border-accent";

  return (
    <div ref={containerRef} className={`relative inline-block ${size === "md" ? "w-full" : ""} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        className={`flex items-center justify-between rounded-lg border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50 text-left cursor-pointer transition-colors duration-160 ${buttonStyleClass} ${sizeClasses[size]}`}
      >
        <span className="truncate mr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-muted shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 z-50 mt-1 max-h-64 rounded-xl border border-separator bg-overlay shadow-overlay ring-1 ring-black/10 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150 ${searchable ? "flex flex-col overflow-hidden p-1.5" : "overflow-y-auto p-1.5"}`}>
          {searchable ? (
            <div className="relative shrink-0 border-b border-separator p-1 pb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  const nextTerm = event.target.value;
                  setSearchTerm(nextTerm);
                  const nextOption = options.findIndex((option) => !option.disabled && option.label.toLocaleLowerCase().includes(nextTerm.trim().toLocaleLowerCase()));
                  setActiveIndex(nextOption);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-label={`Search ${ariaLabel ?? "options"}`}
                aria-controls={listboxId}
                placeholder="Search options…"
                className="h-9 w-full rounded-lg border border-field-border bg-field-background pl-9 pr-3 text-xs text-field-foreground placeholder:text-field-placeholder outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-2.5 py-4 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading options…
            </div>
          ) : filteredOptions.length === 0 ? (
            <div id={listboxId} role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto py-1">
              <div className="px-2.5 py-4 text-center text-xs text-muted">No matching options</div>
            </div>
          ) : (
            <div id={listboxId} role="listbox" aria-label={ariaLabel} className={`${searchable ? "min-h-0 flex-1 overflow-y-auto py-1" : ""}`}>
              {filteredOptions.map(({ option: opt, index }) => {
                const isSelected = opt.value === (value ?? "");
                return (
                  <button
                    key={`${opt.value}::${opt.label}`}
                    type="button"
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    disabled={opt.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex w-full items-center justify-between rounded-lg text-left transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-45 ${size === "sm" ? "min-h-7 px-2 text-[11px]" : "min-h-10 px-3 text-sm"} ${
                      isSelected
                        ? "bg-accent/10 font-semibold text-accent"
                        : index === activeIndex
                          ? "bg-default/70 text-foreground"
                          : "text-foreground hover:bg-default/70"
                    }`}
                  >
                    <span className="truncate mr-2">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
