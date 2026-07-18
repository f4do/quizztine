import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost";
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 cursor-pointer";
  const colors = {
    primary: "bg-tv-red text-white hover:bg-tv-red-dark shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost:
      "bg-transparent text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-gray-800 border border-rose-200 dark:border-gray-700",
  };
  return (
    <button className={`${base} ${colors[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
