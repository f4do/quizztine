export default function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`tv-card border border-rose-200/60 dark:border-rose-900/40 rounded-2xl p-4 bg-white/90 dark:bg-gray-900/90 ${className}`}
    >
      {children}
    </div>
  );
}
