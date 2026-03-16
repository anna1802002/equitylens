"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCompare } from "@/lib/api";
import { SkeletonBox } from "@/components/Skeleton";

const PERIODS = ["1M", "3M", "6M", "1Y"] as const;

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

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  return "$" + Number(p).toFixed(2);
}

function formatPct(p: number | null | undefined): string {
  if (p == null) return "—";
  const n = Number(p);
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}${n.toFixed(2)}%`;
}

function parseDate(s: string): number {
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function msForPeriod(p: (typeof PERIODS)[number]): number {
  const now = Date.now();
  switch (p) {
    case "1M": return 30 * 24 * 60 * 60 * 1000;
    case "3M": return 90 * 24 * 60 * 60 * 1000;
    case "6M": return 180 * 24 * 60 * 60 * 1000;
    case "1Y": return 365 * 24 * 60 * 60 * 1000;
    default: return 365 * 24 * 60 * 60 * 1000;
  }
}

export default function ComparePage() {
  const [ticker1, setTicker1] = useState("AAPL");
  const [ticker2, setTicker2] = useState("MSFT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("1Y");

  const handleCompare = useCallback(async () => {
    const t1 = ticker1.trim();
    const t2 = ticker2.trim();
    if (!t1 || !t2) {
      setError("Enter both tickers to compare.");
      return;
    }
    if (t1.toUpperCase() === t2.toUpperCase()) {
      setError("Choose two different tickers.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await getCompare(t1, t2);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }, [ticker1, ticker2]);

  const chartData = useMemo(() => {
    if (!data?.stock1?.price_history || !data?.stock2?.price_history) return [];
    const h1 = data.stock1.price_history as { date?: string; close?: number }[];
    const h2 = data.stock2.price_history as { date?: string; close?: number }[];
    const ms = msForPeriod(period);
    const cutoff = Date.now() - ms;

    const m1 = new Map<string, number>();
    h1.forEach((b) => {
      const d = b.date?.slice(0, 10) ?? b.date;
      const c = b.close ?? 0;
      if (d && parseDate(d) >= cutoff) m1.set(d, c);
    });
    const m2 = new Map<string, number>();
    h2.forEach((b) => {
      const d = b.date?.slice(0, 10) ?? b.date;
      const c = b.close ?? 0;
      if (d && parseDate(d) >= cutoff) m2.set(d, c);
    });

    const dates = [...new Set([...m1.keys(), ...m2.keys()])]
      .filter((d) => m1.has(d) && m2.has(d))
      .sort();
    if (dates.length === 0) return [];

    const c10 = m1.get(dates[0]) ?? 0;
    const c20 = m2.get(dates[0]) ?? 0;
    return dates.map((date) => {
      const v1 = m1.get(date);
      const v2 = m2.get(date);
      const n1 = c10 > 0 && v1 != null ? (100 * v1) / c10 : 100;
      const n2 = c20 > 0 && v2 != null ? (100 * v2) / c20 : 100;
      return {
        date,
        s1: Number(n1.toFixed(2)),
        s2: Number(n2.toFixed(2)),
      };
    });
  }, [data, period]);

  const rev1 = useMemo(() => {
    const q = data?.stock1?.quarterly_revenue;
    if (!Array.isArray(q) || q.length === 0) return null;
    return (q as { value?: number }[]).reduce((a, b) => a + (b.value ?? 0), 0);
  }, [data?.stock1?.quarterly_revenue]);

  const rev2 = useMemo(() => {
    const q = data?.stock2?.quarterly_revenue;
    if (!Array.isArray(q) || q.length === 0) return null;
    return (q as { value?: number }[]).reduce((a, b) => a + (b.value ?? 0), 0);
  }, [data?.stock2?.quarterly_revenue]);

  const metrics = useMemo(() => {
    if (!data) return [];
    const s1 = data.stock1;
    const s2 = data.stock2;
    const rows: {
      label: string;
      v1: string | number | null;
      v2: string | number | null;
      higher: "1" | "2" | null;
      lower: "1" | "2" | null;
    }[] = [];

    rows.push({
      label: "Current Price",
      v1: s1?.current_price,
      v2: s2?.current_price,
      higher: null,
      lower: null,
    });

    const pe1 = s1?.pe_ratio;
    const pe2 = s2?.pe_ratio;
    const peLower = pe1 != null && pe2 != null ? (pe1 < pe2 ? "1" : "2") : null;
    rows.push({
      label: "P/E Ratio",
      v1: pe1,
      v2: pe2,
      higher: null,
      lower: peLower ?? null,
    });

    const eps1 = s1?.eps;
    const eps2 = s2?.eps;
    const epsHigher = eps1 != null && eps2 != null ? (eps1 > eps2 ? "1" : "2") : null;
    rows.push({
      label: "EPS",
      v1: eps1,
      v2: eps2,
      higher: epsHigher ?? null,
      lower: null,
    });

    const r1 = rev1;
    const r2 = rev2;
    const revHigher = r1 != null && r2 != null ? (r1 > r2 ? "1" : "2") : null;
    rows.push({
      label: "Revenue",
      v1: r1,
      v2: r2,
      higher: revHigher ?? null,
      lower: null,
    });

    const pm1 = s1?.profit_margin;
    const pm2 = s2?.profit_margin;
    const pmHigher = pm1 != null && pm2 != null ? (pm1 > pm2 ? "1" : "2") : null;
    rows.push({
      label: "Profit Margin",
      v1: pm1 != null ? `${(pm1 * 100).toFixed(1)}%` : null,
      v2: pm2 != null ? `${(pm2 * 100).toFixed(1)}%` : null,
      higher: pmHigher ?? null,
      lower: null,
    });

    const risk1 = s1?.risk_score;
    const risk2 = s2?.risk_score;
    const riskLower = risk1 != null && risk2 != null ? (risk1 < risk2 ? "1" : "2") : null;
    rows.push({
      label: "Risk Score",
      v1: risk1,
      v2: risk2,
      higher: null,
      lower: riskLower ?? null,
    });

    rows.push({
      label: "Market Cap",
      v1: s1?.market_cap,
      v2: s2?.market_cap,
      higher: null,
      lower: null,
    });

    rows.push({
      label: "52W High",
      v1: s1?.["52_week_high"],
      v2: s2?.["52_week_high"],
      higher: null,
      lower: null,
    });

    rows.push({
      label: "52W Low",
      v1: s1?.["52_week_low"],
      v2: s2?.["52_week_low"],
      higher: null,
      lower: null,
    });

    rows.push({
      label: "Recommendation",
      v1: s1?.recommendation,
      v2: s2?.recommendation,
      higher: null,
      lower: null,
    });

    return rows;
  }, [data, rev1, rev2]);

  function CompareSkeleton() {
    return (
      <div className="mt-8 space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-6"
            >
              <SkeletonBox className="mb-3 h-8 w-48" />
              <SkeletonBox className="mb-2 h-10 w-32" />
              <SkeletonBox className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-6">
          <SkeletonBox className="mb-4 h-5 w-48" />
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex justify-between border-b border-[#1e1e2e] py-3"
            >
              <SkeletonBox className="h-4 w-32" />
              <SkeletonBox className="h-4 w-20" />
              <SkeletonBox className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      <div className="relative overflow-hidden border-b border-[#1e1e2e]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#60a5fa]/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-[#a855f7]/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Compare Stocks
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-sm text-gray-400"
          >
            Side by side analysis of any two companies
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={ticker1}
                onChange={(e) => setTicker1(e.target.value)}
                placeholder="First Company"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-white outline-none transition focus:border-[#60a5fa] focus:ring-2 focus:ring-[#60a5fa]/30"
              />
              <div className="flex justify-center">
                <span className="rounded-full bg-[#a855f7] px-4 py-2 text-sm font-bold text-white">
                  VS
                </span>
              </div>
              <input
                type="text"
                value={ticker2}
                onChange={(e) => setTicker2(e.target.value)}
                placeholder="Second Company"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-white outline-none transition focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/30"
              />
            </div>
            <button
              onClick={handleCompare}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#60a5fa] to-[#a855f7] px-8 py-3.5 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              Compare
            </button>
          </motion.div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence>
          {loading && !data && <CompareSkeleton />}

          {data && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Company headers */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6" style={{ borderLeftWidth: 4, borderLeftColor: "#60a5fa" }}>
                  <h2 className="text-xl font-bold text-white">{data.stock1?.company_name ?? data.stock1?.ticker}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#60a5fa]/20 px-3 py-0.5 text-sm font-medium text-[#60a5fa]">
                      {data.stock1?.ticker}
                    </span>
                    <span className="text-2xl font-bold text-white">{formatPrice(data.stock1?.current_price)}</span>
                    <span
                      className={
                        (data.stock1?.regular_market_change_percent ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatPct(data.stock1?.regular_market_change_percent)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        data.stock1?.recommendation === "BUY"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : data.stock1?.recommendation === "SELL"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {data.stock1?.recommendation ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6" style={{ borderLeftWidth: 4, borderLeftColor: "#a855f7" }}>
                  <h2 className="text-xl font-bold text-white">{data.stock2?.company_name ?? data.stock2?.ticker}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#a855f7]/20 px-3 py-0.5 text-sm font-medium text-[#a855f7]">
                      {data.stock2?.ticker}
                    </span>
                    <span className="text-2xl font-bold text-white">{formatPrice(data.stock2?.current_price)}</span>
                    <span
                      className={
                        (data.stock2?.regular_market_change_percent ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {formatPct(data.stock2?.regular_market_change_percent)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        data.stock2?.recommendation === "BUY"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : data.stock2?.recommendation === "SELL"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {data.stock2?.recommendation ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Head to head metrics */}
              <div className="overflow-hidden rounded-2xl border border-[#1e1e2e] bg-[#0d0d12]">
                <h3 className="border-b border-[#1e1e2e] px-6 py-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  Head to Head Metrics
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">{data.stock1?.ticker}</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500">Metric</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">{data.stock2?.ticker}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((row, i) => {
                      const fmt = (v: string | number | null) => {
                        if (v == null) return "—";
                        if (row.label === "Market Cap" || row.label === "Revenue") return formatLargeNumber(Number(v));
                        if (row.label === "52W High" || row.label === "52W Low" || row.label === "Current Price") return formatPrice(Number(v));
                        if (row.label === "P/E Ratio" || row.label === "EPS" || row.label === "Risk Score") return v;
                        return String(v);
                      };
                      const w1 = row.higher === "1" || row.lower === "1";
                      const w2 = row.higher === "2" || row.lower === "2";
                      return (
                        <tr key={i} className="border-b border-[#1e1e2e]/50 transition hover:bg-white/[0.02]">
                          <td
                            className={`px-6 py-3 text-left font-medium ${
                              w1 ? "bg-emerald-500/10 text-emerald-300" : "text-white"
                            }`}
                          >
                            {fmt(row.v1)}
                          </td>
                          <td className="px-6 py-3 text-center text-sm text-gray-400">{row.label}</td>
                          <td
                            className={`px-6 py-3 text-right font-medium ${
                              w2 ? "bg-emerald-500/10 text-emerald-300" : "text-white"
                            }`}
                          >
                            {fmt(row.v2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Price chart */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        period === p ? "bg-[#60a5fa] text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#6b7280"
                        fontSize={11}
                        tickFormatter={(v) => (typeof v === "string" ? v.slice(5, 10) || v : v) as string}
                      />
                      <YAxis stroke="#6b7280" fontSize={11} domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#111827", border: "1px solid #1e1e2e", borderRadius: 8 }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div className="rounded-lg border border-[#1e1e2e] bg-[#111827] px-4 py-3 shadow-xl">
                              <p className="text-xs text-gray-400">{typeof label === "string" ? label : ""}</p>
                              <p className="mt-1 font-medium text-[#60a5fa]">
                                {data.stock1?.ticker}: {(d?.s1 ?? 0).toFixed(1)} (norm)
                              </p>
                              <p className="font-medium text-[#a855f7]">
                                {data.stock2?.ticker}: {(d?.s2 ?? 0).toFixed(1)} (norm)
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="s1" name={data.stock1?.ticker} stroke="#60a5fa" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="s2" name={data.stock2?.ticker} stroke="#a855f7" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AI Verdict */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">AI Verdict — Which is the better investment?</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6" style={{ borderLeftWidth: 4, borderLeftColor: "#60a5fa" }}>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-[#60a5fa]">Pros of {data.stock1?.ticker}</h4>
                    <ul className="mt-3 space-y-2">
                      {(data.stock1_pros ?? []).map((p: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60a5fa]" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6" style={{ borderLeftWidth: 4, borderLeftColor: "#a855f7" }}>
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-[#a855f7]">Pros of {data.stock2?.ticker}</h4>
                    <ul className="mt-3 space-y-2">
                      {(data.stock2_pros ?? []).map((p: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a855f7]" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Our Recommendation</h4>
                  <p className="mt-3 leading-relaxed text-gray-300">{data.recommendation ?? "—"}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!data && !loading && (
          <div className="py-20 text-center">
            <p className="text-gray-500">Enter two tickers above to compare</p>
          </div>
        )}
      </div>
    </div>
  );
}
