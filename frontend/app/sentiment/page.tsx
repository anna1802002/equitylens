"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSentiment } from "@/lib/api";
import { SkeletonBox, SkeletonCard } from "@/components/Skeleton";

const SUGGESTION_TICKERS = ["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "NFLX"];

function getLabelStyles(label: string) {
  const l = (label ?? "Neutral").toLowerCase();
  if (l.includes("bull")) {
    return l.includes("slightly")
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-emerald-500/30 text-emerald-200 border-emerald-400/50";
  }
  if (l.includes("bear")) {
    return l.includes("slightly")
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : "bg-red-500/30 text-red-200 border-red-400/50";
  }
  return "bg-gray-500/20 text-gray-300 border-gray-500/40";
}

function getHeadlineBorder(sentiment: string) {
  const s = (sentiment ?? "Neutral").toLowerCase();
  if (s.includes("positive")) return "border-l-4 border-l-emerald-500";
  if (s.includes("negative")) return "border-l-4 border-l-red-500";
  return "border-l-4 border-l-gray-500";
}

function getHeadlineBadgeClass(sentiment: string) {
  const s = (sentiment ?? "Neutral").toLowerCase();
  if (s.includes("positive")) return "bg-emerald-500/20 text-emerald-300";
  if (s.includes("negative")) return "bg-red-500/20 text-red-300";
  return "bg-gray-500/20 text-gray-400";
}

function getBreakdownCardClass(score: number) {
  if (score > 0.2) return "border-emerald-500/50";
  if (score < -0.2) return "border-red-500/50";
  return "border-purple-500/50";
}

function generateTrendDates(): string[] {
  const dates: string[] = [];
  const d = new Date();
  for (let i = 29; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(x.getDate() - i);
    dates.push(x.toISOString().slice(0, 10));
  }
  return dates;
}

const TREND_DATES = generateTrendDates();

function SentimentSkeleton() {
  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-6">
        <SkeletonBox className="mb-4 h-8 w-48" />
        <SkeletonBox className="mb-4 h-16 w-32" />
        <SkeletonBox className="h-4 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="flex gap-4 rounded-xl border border-[#1e1e2e] bg-[#13131f] p-4"
        >
          <SkeletonBox className="h-full w-1 rounded" />
          <div className="flex-1 space-y-2">
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-3 w-32" />
          </div>
          <SkeletonBox className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function SentimentPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const ticker = String(overrideQuery ?? query ?? "").trim();
    if (!ticker) {
      setError("Please enter a ticker or company name.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await getSentiment(ticker);
      setData(res);
      if (overrideQuery) setQuery(overrideQuery);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const trendData = useMemo(() => {
    const trend = data?.trend ?? [];
    return TREND_DATES.map((date, i) => ({
      date: date.slice(5),
      score: Number(trend[i] ?? 0),
    }));
  }, [data?.trend]);

  const score = data?.overall_score ?? 0;
  const scorePct = ((score + 1) / 2) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      {/* Hero search */}
      <div className="relative overflow-hidden border-b border-[#1e1e2e]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl px-4 py-10">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            <span className="bg-gradient-to-r from-purple-400 to-violet-600 bg-clip-text text-transparent">
              Sentiment Analysis
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-1 text-sm text-gray-400"
          >
            AI-powered market sentiment, headlines & trends
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
                className="w-full rounded-xl border border-white/10 bg-black/40 py-3.5 pl-11 pr-4 text-white outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 px-8 py-3.5 font-semibold text-gray-900 shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              Analyze Sentiment
            </button>
          </motion.div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTION_TICKERS.map((sym) => (
              <button
                key={sym}
                onClick={() => handleSearch(sym)}
                className="rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-200 transition hover:border-purple-400 hover:bg-purple-500/20"
              >
                {sym}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence>
          {loading && !data && <SentimentSkeleton />}

          {data && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Sentiment Overview Card */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {data.company_name ?? data.ticker}
                    </h2>
                    <span className="mt-2 inline-block rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-200">
                      {data.ticker}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <p
                      className={`text-4xl font-bold ${
                        score >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {score >= 0 ? "+" : ""}
                      {Number(score).toFixed(2)}
                    </p>
                    <span
                      className={`rounded-xl border px-4 py-2 text-lg font-semibold ${getLabelStyles(
                        data.label
                      )}`}
                    >
                      {data.label ?? "Neutral"}
                    </span>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-red-500/60 via-gray-500/40 to-emerald-500/60">
                    <div
                      className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow-lg transition-all duration-500"
                      style={{ left: `${Math.min(98, Math.max(2, scorePct))}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                    <span>Very Bearish</span>
                    <span>Neutral</span>
                    <span>Very Bullish</span>
                  </div>
                </div>
                <p className="mt-4 text-xs italic text-gray-500">
                  Based on AI analysis of recent news and market data
                </p>
              </div>

              {/* Sentiment Breakdown */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  {
                    title: "News Sentiment",
                    score: data.news_sentiment_score ?? 0,
                    label: data.news_sentiment_label ?? "Neutral",
                  },
                  {
                    title: "Market Momentum",
                    score: data.market_momentum_score ?? 0,
                    label: data.market_momentum_label ?? "Neutral",
                  },
                  {
                    title: "Analyst Outlook",
                    score: data.analyst_outlook_score ?? 0,
                    label: data.analyst_outlook_label ?? "Neutral",
                  },
                ].map((item) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={`rounded-xl border bg-[#0d0d12] p-4 ${getBreakdownCardClass(
                      item.score
                    )}`}
                  >
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-2xl font-bold text-white">
                      {(item.score >= 0 ? "+" : "") + Number(item.score).toFixed(2)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.score > 0.2
                          ? "bg-emerald-500/20 text-emerald-300"
                          : item.score < -0.2
                          ? "bg-red-500/20 text-red-300"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* News Headlines */}
              <div>
                <h3 className="mb-4 text-lg font-semibold text-white">
                  Recent News Analysis
                </h3>
                <div className="space-y-3">
                  {(data.headlines ?? []).slice(0, 6).map((h: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      className={`rounded-xl border border-[#1e1e2e] bg-[#0d0d12] p-4 ${getHeadlineBorder(
                        h.sentiment
                      )}`}
                    >
                      <p className="font-semibold text-white">{h.title ?? "—"}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{h.source ?? "—"}</span>
                        <span>·</span>
                        <span>{h.date ?? "—"}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${getHeadlineBadgeClass(
                            h.sentiment
                          )}`}
                        >
                          {h.sentiment ?? "Neutral"}
                        </span>
                      </div>
                      {h.one_line_summary && (
                        <p className="mt-2 text-sm text-gray-400">{h.one_line_summary}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Sentiment Trend Chart */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">
                  Sentiment Trend (Last 30 Days)
                </h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e1e2e"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#6b7280"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={11}
                        domain={[-1, 1]}
                        tickFormatter={(v) => (v >= 0 ? "+" : "") + v}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #1e1e2e",
                          borderRadius: 8,
                        }}
                        formatter={(value: number) => [
                          (value >= 0 ? "+" : "") + value.toFixed(2),
                          "Sentiment",
                        ]}
                        labelFormatter={(l) => `Date: ${l}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ fill: "#a855f7", r: 3 }}
                        activeDot={{ r: 5, fill: "#a855f7" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* What This Means */}
              <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">
                  What This Means
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {data.plain_summary ?? ""}
                </p>
                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-emerald-400">
                      What's Driving Positive Sentiment
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-400">
                      {(data.positive_drivers ?? []).map((d: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 list-disc pl-4">
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-red-400">
                      What's Driving Negative Sentiment
                    </h4>
                    <ul className="space-y-1 text-sm text-gray-400">
                      {(data.negative_drivers ?? []).map((d: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 list-disc pl-4">
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!data && !loading && (
          <div className="py-20 text-center">
            <p className="text-gray-500">Enter a ticker above to analyze sentiment</p>
          </div>
        )}
      </div>
    </div>
  );
}
