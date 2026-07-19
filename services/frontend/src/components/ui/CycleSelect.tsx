import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface CycleSelectOption {
  value: string;
  label: string;
}

interface CycleSelectProps {
  label: string;
  value: string;
  options: CycleSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * CycleSelect — a compact alternative to <Select> with two affordances:
 *   1. ◀ ▶ cycle through the options one at a time (wraps at both ends).
 *   2. Clicking the value pill opens a floating popover listing every option.
 *
 * Designed for the avatar builder in the host admin, where there are dozens
 * of values per field and a full <select> dropdown would be overwhelming.
 */
export default function CycleSelect({
  label,
  value,
  options,
  onChange,
  className = "",
}: CycleSelectProps) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Resolve the active option; if the current value is not in the list, fall
  // back to the first option so cycling/display always work.
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[currentIndex] ?? options[0];

  const cycle = (direction: 1 | -1) => {
    if (options.length <= 1) return;
    const nextIndex =
      (currentIndex + direction + options.length) % options.length;
    onChange(options[nextIndex].value);
  };

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Decide whether to open up or down based on viewport space
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // ~200px popover + a small buffer
    setOpenUp(spaceBelow < 220 && spaceAbove > spaceBelow);
  }, [open]);

  // When the popover opens, scroll the selected item into view
  useLayoutEffect(() => {
    if (!open) return;
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative block text-sm font-bold text-gray-700 dark:text-gray-300 ${className}`}
    >
      <span className="block mb-1 truncate">{label}</span>
      <div className="flex items-stretch gap-1.5">
        {/* Previous */}
        <button
          type="button"
          aria-label={`Previous ${label}`}
          onClick={() => cycle(-1)}
          disabled={options.length <= 1}
          className="shrink-0 w-8 h-9 rounded-lg border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-gray-700 hover:border-tv-red transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center font-bold"
        >
          ◀
        </button>

        {/* Value pill (opens popover) */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex-1 min-w-0 h-9 px-3 rounded-lg border-2 transition-colors cursor-pointer flex items-center justify-between gap-2 text-sm font-semibold ${
            open
              ? "border-tv-gold bg-rose-50 dark:bg-rose-900/20 text-tv-red dark:text-tv-gold"
              : "border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:border-tv-red"
          }`}
        >
          <span className="truncate text-left flex-1">
            {current ? current.label : "—"}
          </span>
          <svg
            viewBox="0 0 20 20"
            className={`w-4 h-4 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Next */}
        <button
          type="button"
          aria-label={`Next ${label}`}
          onClick={() => cycle(1)}
          disabled={options.length <= 1}
          className="shrink-0 w-8 h-9 rounded-lg border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-gray-700 hover:border-tv-red transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center font-bold"
        >
          ▶
        </button>
      </div>

      {/* Popover */}
      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          className={`absolute z-50 left-0 right-0 ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          } rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 shadow-2xl max-h-[200px] overflow-y-auto`}
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No options
            </p>
          ) : (
            <ul className="py-1">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      ref={isSelected ? selectedRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => choose(opt.value)}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2 ${
                        isSelected
                          ? "bg-tv-red text-white font-bold"
                          : "text-gray-800 dark:text-gray-100 hover:bg-rose-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {isSelected && (
                        <span aria-hidden="true" className="text-xs">
                          ✓
                        </span>
                      )}
                      <span className="truncate flex-1">{opt.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
