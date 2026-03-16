interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function ChartCard({
  title,
  children,
  className = "",
}: ChartCardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 opacity-0 animate-fade-in ${className}`}
      style={{ backgroundColor: "#13131f" }}
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
        {title}
      </p>
      <div className="min-h-[280px]">{children}</div>
    </div>
  );
}
