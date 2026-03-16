interface KPICardProps {
  title: string;
  value: string | number;
  className?: string;
}

export default function KPICard({ title, value, className = "" }: KPICardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 opacity-0 animate-fade-in ${className}`}
      style={{ backgroundColor: "#13131f" }}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
