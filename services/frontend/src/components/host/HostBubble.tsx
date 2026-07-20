import { useEffect, useState } from "react";

export type HostVariant = "default" | "success" | "error" | "warning";

interface HostBubbleProps {
  message: string;
  name?: string;
  className?: string;
  typing?: boolean;
  variant?: HostVariant;
}

const variantBase = {
  default:
    "bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 border-tv-red/40",
  success:
    "bg-green-50/95 dark:bg-green-900/80 text-green-900 dark:text-green-100",
  error: "bg-red-50/95 dark:bg-red-900/80 text-red-900 dark:text-red-100",
  warning:
    "bg-amber-50/95 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100",
};

const variantBorder = {
  default: "",
  success: "border-green-200 dark:border-green-800",
  error: "border-red-200 dark:border-red-800",
  warning: "border-amber-200 dark:border-amber-800",
};

export default function HostBubble({
  message,
  name = "Host",
  className = "",
  typing = false,
  variant = "default",
}: HostBubbleProps) {
  const [display, setDisplay] = useState(message);

  useEffect(() => {
    if (!typing) {
      setDisplay(message);
      return;
    }
    let i = 0;
    setDisplay("");
    const interval = setInterval(() => {
      i += 1;
      setDisplay(message.slice(0, i));
      if (i >= message.length) clearInterval(interval);
    }, 22);
    return () => clearInterval(interval);
  }, [message, typing]);

  const borderClass = variant === "default" ? "" : variantBorder[variant];

  return (
    <div
      className={`relative rounded-2xl rounded-br-md px-4 py-3 border-2 shadow-lg backdrop-blur-sm ${variantBase[variant]} ${borderClass} ${className}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold tracking-wider uppercase text-tv-red dark:text-tv-gold">
          {name}
        </span>
      </div>
      <p className="text-sm leading-relaxed font-medium">{display}</p>
      {typing && display.length < message.length && (
        <span className="inline-block w-1 h-3 ml-0.5 align-middle bg-current animate-pulse" />
      )}
      {/* Decorative tail pointing toward the avatar */}
      <div
        className="absolute -right-2 bottom-4 w-4 h-4 border-t-2 border-r-2 transform rotate-45 border-tv-red/40"
        style={{ backgroundColor: "inherit" }}
      />
    </div>
  );
}
