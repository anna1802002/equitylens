'use client';

export function SkeletonBox({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse bg-[#1e1e2e] rounded-lg ${className}`}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse bg-[#1e1e2e] rounded h-4"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-[#13131f] border border-[#1e1e2e] rounded-xl p-5 ${className}`}
    >
      <SkeletonBox className="h-3 w-24 mb-4" />
      <SkeletonBox className="h-8 w-32 mb-2" />
      <SkeletonText lines={2} />
    </div>
  );
}

