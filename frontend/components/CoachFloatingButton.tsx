"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CoachFloatingButton() {
  const pathname = usePathname();
  if (pathname === "/coach") return null;

  return (
    <Link
      href="/coach"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-500 hover:shadow-violet-500/25"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      Ask Coach
    </Link>
  );
}
