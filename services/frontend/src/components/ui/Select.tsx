import type { SelectHTMLAttributes } from "react";

interface Option {
  value: string;
  label: string;
}

interface OptionGroup {
  label: string;
  options: Option[];
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  placeholder?: string;
  options?: Option[];
  groups?: OptionGroup[];
}

export default function Select({
  label,
  placeholder,
  options,
  groups,
  className = "",
  ...props
}: SelectProps) {
  return (
    <label
      className={`block text-sm font-bold text-gray-700 dark:text-gray-300 ${className}`}
    >
      {label}
      <select
        className="mt-1 block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:border-tv-gold focus:outline-none dark:text-gray-100 transition-colors cursor-pointer"
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : groups?.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>
    </label>
  );
}
