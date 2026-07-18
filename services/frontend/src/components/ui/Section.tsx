export default function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tv-card border border-rose-200/60 dark:border-rose-900/40 rounded-2xl p-4 bg-white/90 dark:bg-gray-900/90">
      <h2 className="font-display text-2xl mb-4 text-tv-purple dark:text-tv-gold uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}
