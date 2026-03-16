"use client";

import Link from "next/link";

const links: { label: string; href: string; featured?: boolean }[] = [
  { label: "Research", href: "/research" },
  { label: "Watchlist", href: "/watchlist" },
  { label: "Financials", href: "/financials" },
  { label: "Compare", href: "/compare" },
  { label: "Sentiment", href: "/sentiment" },
  { label: "History", href: "/history" },
  { label: "Coach", href: "/coach", featured: true },
  { label: "Eval Metrics", href: "/eval" },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/research" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-bg">
            EL
          </span>
          <span className="text-lg font-semibold text-white">EquityLens</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white ${
                link.featured ? "pr-6" : ""
              }`}
            >
              {link.label}
              {link.featured && (
                <span className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet-500" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
