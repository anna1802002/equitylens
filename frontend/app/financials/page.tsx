"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFinancials } from "@/lib/api";
import TradingViewChart from "@/components/TradingViewChart";
import { SkeletonBox } from "@/components/Skeleton";

const SUGGESTION_TICKERS = ["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "NFLX"];

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null) return "—";
  const n = Number(num);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toLocaleString()}`;
}

function formatVolume(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  return "$" + Number(p).toFixed(2);
}

function formatPct(p: number | null | undefined): string {
  if (p == null) return "";
  const n = Number(p);
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}${n.toFixed(2)}%`;
}

export default function FinancialsPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [period, setPeriod] = useState<string>("1Y");

  const handleSearch = useCallback(
    async (overrideQuery?: string) => {
      const ticker = String(overrideQuery ?? query ?? "").trim();
      if (!ticker) {
        setError("Please enter a ticker or company name.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const res = await getFinancials(ticker, "1Y");
        setData(res);
        if (overrideQuery) setQuery(overrideQuery);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
      }
    },
    [query, period]
  );

  const priceUp = (data?.regular_market_change ?? 0) >= 0;

  const revenueData = useMemo(() => {
    const rev = data?.quarterly_revenue ?? [];
    return rev.map((r: any) => ({
      period: r.period?.slice(0, 7) ?? "",
      value: r.value ?? 0,
    }));
  }, [data?.quarterly_revenue]);

  const earningsData = useMemo(() => {
    const earn = data?.quarterly_earnings ?? [];
    return earn.map((e: any) => ({
      period: e.period?.slice(0, 7) ?? "",
      value: e.value ?? 0,
    }));
  }, [data?.quarterly_earnings]);

  const marketState = data?.market_state ?? "UNKNOWN";
  const marketLabel =
    marketState === "REGULAR" || marketState === "PRE"
      ? "Market Open"
      : marketState === "POST"
      ? "After Hours"
      : "Market Closed";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      {/* Hero search section */}
      <div className="relative overflow-hidden border-b border-[#1e1e2e]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
              Financials
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-sm text-gray-400"
          >
            Yahoo Finance meets Bloomberg — live price action, key stats & fundamentals
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                $
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search ticker or company e.g. AAPL, Apple, Tesla..."
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3.5 pl-11 pr-4 text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3.5 font-semibold text-gray-900 shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              Get Quote
            </button>
          </motion.div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTION_TICKERS.map((sym) => (
              <button
                key={sym}
                onClick={() => handleSearch(sym)}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20"
              >
                {sym}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence>
          {loading && !data && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="mt-8 space-y-6">
                {/* Header */}
                <div className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-6">
                  <SkeletonBox className="mb-3 h-8 w-48" />
                  <SkeletonBox className="mb-2 h-12 w-32" />
                  <SkeletonBox className="h-4 w-24" />
                </div>

                {/* Chart skeleton */}
                <div className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-6">
                  <SkeletonBox className="mb-4 h-5 w-32" />
                  <SkeletonBox className="h-96 w-full" />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-4"
                    >
                      <SkeletonBox className="mb-2 h-3 w-16" />
                      <SkeletonBox className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {data && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Company header */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-white">
                        {data.company_name ?? data.ticker}
                      </h2>
                      <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-sm font-medium text-emerald-300">
                        {data.ticker}
                      </span>
                      <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5 text-xs text-gray-400">
                        {marketLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {data.exchange || "—"} · {data.currency || "USD"}
                    </p>
                  </div>
                  <div className="text-right sm:text-right">
                    <p className="text-4xl font-bold text-white">
                      {formatPrice(data.current_price)}
                    </p>
                    <p
                      className={`mt-1 flex items-center justify-end gap-1 text-lg font-medium ${
                        priceUp ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {priceUp ? "▲" : "▼"}{" "}
                      {data.regular_market_change != null
                        ? `${priceUp ? "+" : ""}${Number(data.regular_market_change).toFixed(2)}`
                        : ""}{" "}
                      <span>
                        {formatPct(data.regular_market_change_percent)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Price chart - TradingView */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-white">Price Chart</h3>
                  <p className="text-xs text-gray-400">
                    Interactive chart powered by TradingView
                  </p>
                </div>
                <div className="h-[500px] w-full">
                  <TradingViewChart
                    ticker={data.ticker}
                    exchange={data.exchange}
                  />
                </div>
              </div>

              {/* Key stats row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {[
                  { label: "Open", value: data.open, fmt: formatPrice },
                  { label: "High", value: data.high, fmt: formatPrice },
                  { label: "Low", value: data.low, fmt: formatPrice },
                  { label: "Volume", value: data.volume, fmt: formatVolume },
                  { label: "Mkt Cap", value: data.market_cap, fmt: formatLargeNumber },
                  { label: "P/E Ratio", value: data.pe_ratio, fmt: (v: number) => v?.toFixed(2) ?? "—" },
                  { label: "52W High", value: data["52_week_high"], fmt: formatPrice },
                  { label: "52W Low", value: data["52_week_low"], fmt: formatPrice },
                  { label: "Avg Volume", value: data.avg_volume, fmt: formatVolume },
                ].map(({ label, value, fmt }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#1e1e2e] bg-[#0d0d12] p-4"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {fmt(value)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Revenue & Earnings */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
                >
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Quarterly Revenue
                  </h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e1e2e"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          stroke="#6b7280"
                          fontSize={11}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={11}
                          tickFormatter={(v) =>
                            v >= 1e9 ? `${v / 1e9}B` : v >= 1e6 ? `${v / 1e6}M` : v
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111827",
                            border: "1px solid #1e1e2e",
                            borderRadius: 8,
                          }}
                          formatter={(value: number) => [
                            formatLargeNumber(value),
                            "Revenue",
                          ]}
                        />
                        <Bar
                          dataKey="value"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
                >
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                    Quarterly Earnings (EPS / Net Income)
                  </h3>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={earningsData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e1e2e"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="period"
                          stroke="#6b7280"
                          fontSize={11}
                        />
                        <YAxis stroke="#6b7280" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#111827",
                            border: "1px solid #1e1e2e",
                            borderRadius: 8,
                          }}
                          formatter={(value: number) => [
                            formatLargeNumber(value),
                            "Earnings",
                          ]}
                        />
                        <Bar
                          dataKey="value"
                          fill="#3b82f6"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>

              {/* Profit metrics */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
              >
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Profit Metrics
                </h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      label: "Profit Margin",
                      value: data.profit_margin,
                      desc: "Net profit as % of revenue — how much the company keeps after all expenses.",
                    },
                    {
                      label: "Gross Margin",
                      value: data.gross_margin,
                      desc: "Revenue minus cost of goods sold — efficiency of production.",
                    },
                    {
                      label: "Operating Margin",
                      value: data.operating_margin,
                      desc: "Operating income as % of revenue — core business profitability.",
                    },
                    {
                      label: "Return on Equity",
                      value: data.return_on_equity,
                      desc: "Net income relative to shareholders' equity — how well capital is used.",
                    },
                  ].map(({ label, value, desc }) => {
                    const pct =
                      value != null ? (typeof value === "number" ? value * 100 : value) : null;
                    return (
                      <div key={label}>
                        <p className="text-xs font-medium text-gray-300">{label}</p>
                        <p className="mt-1 text-2xl font-bold text-white">
                          {pct != null ? `${pct.toFixed(1)}%` : "—"}
                        </p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(0, pct ?? 0))}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                          {desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!data && !loading && (
          <div className="py-20 text-center">
            <p className="text-gray-500">Enter a ticker above to load financials</p>
          </div>
        )}
      </div>
    </div>
  );
}
