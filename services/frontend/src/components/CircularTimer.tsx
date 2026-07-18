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
  const circumference = 2 * Math.PI * radius;

  const ringRef = useRef<SVGCircleElement>(null);
  const prevTimeLeftRef = useRef(timeLeft);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;

    const targetOffset =
      circumference * (1 - (total > 0 ? timeLeft / total : 0));
    const from = prevTimeLeftRef.current;
    prevTimeLeftRef.current = timeLeft;

    if (stopped || from === timeLeft) {
      ring.style.strokeDashoffset = `${targetOffset}`;
      return;
    }

    const fromOffset = circumference * (1 - (total > 0 ? from / total : 0));
    const startTime = performance.now();
    let rafId: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / 1000, 1);
      const currentOffset = fromOffset + (targetOffset - fromOffset) * progress;
      if (ringRef.current) {
        ringRef.current.style.strokeDashoffset = `${currentOffset}`;
      }
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [timeLeft, total, circumference, stopped]);

  let colorClass = "text-emerald-500";
  if (timeLeft <= dangerThreshold) colorClass = "text-red-500";
  else if (timeLeft <= warningThreshold) colorClass = "text-amber-500";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90 w-full h-full">
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
          strokeDasharray={circumference}
          strokeDashoffset={
            circumference * (1 - (total > 0 ? timeLeft / total : 0))
          }
          strokeLinecap="round"
          className={`${colorClass} ${stopped ? "opacity-60" : ""}`}
        />
      </svg>
      <span
        className={`absolute text-lg font-bold tabular-nums ${
          timeLeft <= dangerThreshold
            ? "text-red-500 animate-countdown-pulse"
            : timeLeft <= warningThreshold
              ? "text-amber-500"
              : "text-gray-700 dark:text-gray-200"
        }`}
      >
        {stopped ? (
          <svg
            className={`w-6 h-6 ${colorClass}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
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
