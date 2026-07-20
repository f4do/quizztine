import { useEffect, useRef } from "react";

interface CircularTimerProps {
  timeLeft: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  stopped?: boolean;
}

export default function CircularTimer({
  timeLeft,
  total,
  size = 72,
  strokeWidth = 6,
  warningThreshold = 10,
  dangerThreshold = 5,
  stopped = false,
}: CircularTimerProps) {
  const radius = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * radius;

  const ringRef = useRef<SVGCircleElement>(null);
  const updateRef = useRef({ val: timeLeft, at: performance.now() });

  useEffect(() => {
    updateRef.current = { val: timeLeft, at: performance.now() };
  });

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    let id: number;

    if (stopped) {
      // Freeze animation at current position
      const fraction = total > 0 ? timeLeft / Math.max(total, 1) : 0;
      const visible = fraction * c;
      ring.setAttribute("stroke-dasharray", `${visible} ${c}`);
      ring.setAttribute("stroke-dashoffset", "0");
      return;
    }

    const tick = (now: number) => {
      const { val, at } = updateRef.current;
      const cur = Math.max(0, val - (now - at) / 1000);
      const fraction = total > 0 ? cur / Math.max(total, 1) : 0;
      const visible = fraction * c;

      if (ringRef.current) {
        ringRef.current.setAttribute("stroke-dasharray", `${visible} ${c}`);
        ringRef.current.setAttribute("stroke-dashoffset", "0");
      }

      id = requestAnimationFrame(tick);
    };

    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [total, c, stopped, timeLeft]);

  const color =
    timeLeft <= dangerThreshold
      ? "text-red-500"
      : timeLeft <= warningThreshold
        ? "text-amber-500"
        : "text-emerald-500";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span
        className={`absolute text-lg font-bold tabular-nums ${
          stopped
            ? "text-emerald-500"
            : timeLeft <= dangerThreshold
              ? "text-red-500 animate-countdown-pulse"
              : timeLeft <= warningThreshold
                ? "text-amber-500"
                : "text-gray-700 dark:text-gray-200"
        }`}
      >
        {stopped ? (
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          timeLeft
        )}
      </span>
    </div>
  );
}
