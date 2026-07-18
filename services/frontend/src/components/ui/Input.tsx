import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, className = "", ...props }: InputProps) {
  return (
    <label
      className={`block text-sm font-bold text-gray-700 dark:text-gray-300 ${className}`}
    >
      {label}
      <input
        className="mt-1 block w-full rounded-xl border-2 border-rose-200 dark:border-rose-900/50 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm shadow-sm focus:border-tv-gold focus:outline-none dark:text-gray-100 transition-colors"
        {...props}
      />
    </label>
  );
}
