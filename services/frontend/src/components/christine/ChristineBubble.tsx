import { useEffect, useState } from "react";

interface ChristineBubbleProps {
  text: string;
  name?: string;
  className?: string;
  typing?: boolean;
  variant?: "default" | "success" | "error" | "warning";
}

const variants = {
  default:
    "bg-white/95 dark:bg-gray-900/95 border-rose-200 dark:border-rose-800 text-gray-900 dark:text-gray-100",
  success:
    "bg-green-50/95 dark:bg-green-900/80 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100",
  error:
    "bg-red-50/95 dark:bg-red-900/80 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100",
  warning:
    "bg-amber-50/95 dark:bg-amber-900/80 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
};

export default function ChristineBubble({
  text,
  name = "Christine",
  className = "",
  typing = false,
  variant = "default",
}: ChristineBubbleProps) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!typing) {
      setDisplay(text);
      return;
    }
    let i = 0;
    setDisplay("");
    const interval = setInterval(() => {
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 22);
    return () => clearInterval(interval);
  }, [text, typing]);

  return (
    <div
      className={`relative rounded-2xl rounded-br-md px-4 py-3 border shadow-lg backdrop-blur-sm ${variants[variant]} ${className}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold tracking-wider uppercase text-tv-red dark:text-tv-gold">
          {name}
        </span>
        <svg
          className="w-3 h-3 text-tv-red dark:text-tv-gold"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C10.34 2 9 3.34 9 5v10c0 1.66 1.34 3 3 3s3-1.34 3-3V5c0-1.66-1.34-3-3-3zm-1 17.93a7 7 0 0014 0v-1h-14v1zm2-1.5h6v-1h-6v1z" />
        </svg>
      </div>
      <p className="text-sm leading-relaxed font-medium">{display}</p>
      {typing && display.length < text.length && (
        <span className="inline-block w-1 h-3 ml-0.5 align-middle bg-current animate-pulse" />
      )}
      {/* Decorative tail pointing toward the avatar */}
      <div className="absolute -right-2 bottom-4 w-4 h-4 bg-inherit border-t border-r border-current/20 transform rotate-45" />
    </div>
  );
}
