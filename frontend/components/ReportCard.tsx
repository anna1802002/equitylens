interface ReportCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function ReportCard({
  title = "Analyst Report",
  children,
  className = "",
}: ReportCardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-5 opacity-0 animate-fade-in shadow-lg shadow-accent/5 ${className}`}
      style={{
        backgroundColor: "#13131f",
        borderColor: "#1e1e2e",
        boxShadow: "0 0 40px -10px rgba(96, 165, 250, 0.08)",
      }}
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
        {title}
      </p>
      <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap text-sm text-gray-200">
        {children}
      </div>
    </div>
  );
}
