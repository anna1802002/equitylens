"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { exportResearchPDF } from "@/lib/exportPDF";
import TradingViewMini from "@/components/TradingViewMini";
import { SkeletonBox, SkeletonText } from "@/components/Skeleton";

type SectionKey = "kpi" | "sentiment" | "risk" | "verdict";

interface ReportSection {
  key: SectionKey;
  title: string;
  content: string;
}

function formatLargeNumber(num: number | null | undefined): string {
  if (num == null) return "—";
  const n = Number(num);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)} Trillion`;
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)} Billion`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)} Million`;
  return `$${n.toLocaleString()}`;
}

function formatCurrencyLarge(v: number | null | undefined): string {
  return formatLargeNumber(v);
}

function formatNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "—";
  return Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

function truncateToSentences(text: string, maxSentences: number = 3): string {
  if (!text?.trim()) return "";
  const sentences = text
    .replace(/[.!?]+/g, (m) => m + "\0")
    .split("\0")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = sentences.slice(0, maxSentences).join(". ");
  return result ? (result.match(/[.!?]$/) ? result : result + ".") : "";
}

function formatEmployees(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString() + " employees";
}

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  return "$" + Number(p).toFixed(2);
}

function formatMargin(m: number | null | undefined): string {
  if (m == null) return "—";
  return (Number(m) * 100).toFixed(1) + "%";
}

function formatEps(eps: number | null | undefined): string {
  if (eps == null) return "—";
  return "$" + Number(eps).toFixed(2) + " per share";
}

function splitReport(report?: string): ReportSection[] {
  if (!report) return [];
  const cleaned = cleanMarkdown(report);
  const patterns: { key: SectionKey; title: string; regex: RegExp }[] = [
    { key: "kpi", title: "Financial Health", regex: /1\.\s*KPI Summary[\s\S]*?(?=\n\s*\d\.\s*|$)/i },
    { key: "sentiment", title: "Market Sentiment", regex: /2\.\s*News Sentiment[\s\S]*?(?=\n\s*\d\.\s*|$)/i },
    { key: "risk", title: "Risk Assessment", regex: /3\.\s*Risk Factors[\s\S]*?(?=\n\s*\d\.\s*|$)/i },
    { key: "verdict", title: "AI Verdict", regex: /4\.\s*Analyst Verdict[\s\S]*?(?=\n\s*\d\.\s*|$)/i },
  ];
  const sections: ReportSection[] = [];
  for (const { key, title, regex } of patterns) {
    const match = cleaned.match(regex);
    if (match) {
      const raw = match[0].replace(/^\d\.\s*[^\n]+\n?/, "").trim();
      sections.push({ key, title, content: raw });
    }
  }
  if (!sections.length) {
    sections.push({ key: "verdict", title: "AI Verdict", content: cleaned });
  }
  return sections;
}

function InvestmentCalculator({
  price,
  recommendation,
}: {
  price: number;
  recommendation: string;
}) {
  const [amount, setAmount] = useState(1000);
  const shares = price > 0 ? amount / price : 0;

  const scenarios = [
    { label: "-10%", pct: -10, value: amount * 0.9, fill: "#ef4444" },
    { label: "0%", pct: 0, value: amount, fill: "#6b7280" },
    { label: "+10%", pct: 10, value: amount * 1.1, fill: "#22c55e" },
    { label: "+20%", pct: 20, value: amount * 1.2, fill: "#16a34a" },
  ];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-gray-400">
          How much are you thinking of investing?
        </span>
        <input
          type="number"
          min={100}
          step={100}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          className="mt-1 block w-full max-w-[200px] rounded-lg border border-amber-500/30 bg-black/20 px-4 py-2 text-white"
        />
      </label>
      <p className="text-sm text-gray-300">
        At current price of {formatPrice(price)}, ${amount.toLocaleString()} buys you approximately{" "}
        <strong className="text-white">{shares.toFixed(1)}</strong> shares
      </p>
      {recommendation === "BUY" && (
        <div className="space-y-2 rounded-lg bg-amber-500/10 p-4">
          <p className="text-xs font-medium text-amber-200">Hypothetical scenarios (not predictions)</p>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>If the stock grows 10%: your ${amount.toLocaleString()} becomes {formatPrice(amount * 1.1)}</li>
            <li>If the stock grows 20%: your ${amount.toLocaleString()} becomes {formatPrice(amount * 1.2)}</li>
            <li>If the stock drops 10%: your ${amount.toLocaleString()} becomes {formatPrice(amount * 0.9)}</li>
          </ul>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scenarios} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #374151",
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => [formatPrice(value), "Value"]}
                />
                <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]} fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            These are hypothetical scenarios, not predictions. Past performance does not guarantee future results.
          </p>
        </div>
      )}
      {recommendation !== "BUY" && (
        <p className="text-xs text-gray-500">
          Scenario chart shown for BUY recommendations. Our recommendation: {recommendation}
        </p>
      )}
    </div>
  );
}

function useCountUp(value: number, duration = 0.6) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = display;
    const to = value;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

const WS_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_WS_URL) ||
  "ws://127.0.0.1:8000";

function ResearchSkeleton({ loadingMessage }: { loadingMessage?: string }) {
  return (
    <div className="mt-8 space-y-6">
      {/* Company hero skeleton */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-6">
        <div className="flex justify-between">
          <div className="space-y-3">
            <SkeletonBox className="h-4 w-20" />
            <SkeletonBox className="h-8 w-64" />
            <SkeletonBox className="h-10 w-32" />
          </div>
          <SkeletonBox className="h-12 w-24 rounded-full" />
        </div>
        <SkeletonBox className="mt-6 h-3 w-full" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-4"
          >
            <SkeletonBox className="mb-3 h-3 w-20" />
            <SkeletonBox className="mb-2 h-8 w-24" />
            <SkeletonBox className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Report sections skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-5"
          >
            <SkeletonBox className="mb-4 h-5 w-40" />
            <SkeletonText lines={4} />
            <SkeletonBox className="mt-4 h-8 w-32" />
          </div>
        ))}
      </div>

      {/* Bottom line skeleton */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#13131f] p-5">
        <SkeletonBox className="mb-4 h-5 w-56" />
        {loadingMessage ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            {loadingMessage}
          </div>
        ) : (
          <SkeletonText lines={4} />
        )}
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const searchParams = useSearchParams();
  const tickerParam = searchParams.get("ticker");
  const [query, setQuery] = useState<string>(tickerParam || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const handleRun = (overrideQuery?: string) => {
    const trimmed = String(overrideQuery ?? query ?? "").trim();
    if (!trimmed) {
      setError("Please enter a ticker or company name.");
      return;
    }
    if (overrideQuery) setQuery(overrideQuery);
    setError(null);
    setData(null);
    setStreamedText("");
    setLoading(true);
    setLoadingMessage("");
    setIsStreaming(false);

    const wsUrl = `${WS_BASE}/api/ws/research`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ ticker: trimmed }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "status") {
          setLoadingMessage(msg.message);
        }
        if (msg.type === "stream_start") {
          setIsStreaming(true);
          setStreamedText("");
        }
        if (msg.type === "token") {
          setStreamedText((prev) => prev + (msg.content || ""));
        }
        if (msg.type === "stream_end") {
          setIsStreaming(false);
        }
        if (msg.type === "complete" || msg.type === "cached") {
          setData(msg.data);
          setLoading(false);
          ws.close();
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }
        if (msg.type === "error") {
          setError(msg.message || "Research failed");
          setLoading(false);
          ws.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setError("Connection failed. Make sure the backend is running.");
      setLoading(false);
      ws.close();
    };

    ws.onclose = () => {
      if (loading && !data) {
        setLoading(false);
      }
    };
  };

  useEffect(() => {
    if (tickerParam && tickerParam.trim()) {
      handleRun(tickerParam.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerParam]);

  const risk = data?.risk_score ?? 0;
  const riskDisplay = useCountUp(risk);
  const riskBucket =
    risk < 20 ? "Very Safe" : risk < 40 ? "Safe" : risk < 60 ? "Moderate" : risk < 80 ? "Risky" : "Dangerous";
  const signal = data?.recommendation ?? (risk < 33 ? "BUY" : risk <= 66 ? "HOLD" : "SELL");
  const companyName = data?.company_name || data?.ticker || String(query ?? "").trim();
  const tickerLabel = data?.ticker ?? String(query ?? "").trim().toUpperCase();
  const price = data?.financials?.current_price ?? null;
  const priceDisplay = useCountUp(price ?? 0);
  const sections = useMemo(() => {
    if (!data) return splitReport("");
    const report = data.report;
    const text =
      typeof report === "string"
        ? report
        : report?.plain_summary || data.plain_summary || "";
    return splitReport(text);
  }, [data]);

  useEffect(() => {
    if (data) console.log("Report data:", data?.report);
  }, [data]);

  const kpiSection = sections.find((s) => s.key === "kpi");
  const sentimentSection = sections.find((s) => s.key === "sentiment");
  const riskSection = sections.find((s) => s.key === "risk");
  const verdictSection = sections.find((s) => s.key === "verdict");

  const suggestionTickers = useMemo(() => {
    const q = String(query ?? "").toLowerCase().replace(/\s+/g, "");
    if (!q || q.length < 2) return [] as string[];
    if (q.includes("tes")) return ["TSLA"];
    if (q.includes("app")) return ["AAPL", "APP"];
    if (q.includes("mic")) return ["MSFT", "MU"];
    if (q.includes("goog") || q.includes("alph")) return ["GOOGL", "GOOG"];
    if (q.includes("nvd") || q.includes("nvda") || q.includes("envid")) return ["NVDA"];
    if (q.includes("amaz") || q.includes("amzn")) return ["AMZN"];
    return [] as string[];
  }, [query]);

  const notFoundMatch = error?.match(/Could not find stock for '(.+?)'/i);
  const notFoundQuery = notFoundMatch?.[1];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      {/* Animated gradient mesh background for hero */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-40 top-0 h-72 w-72 animate-pulse rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute right-0 top-10 h-72 w-72 animate-pulse rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute left-1/4 bottom-0 h-72 w-72 animate-pulse rounded-full bg-cyan-500/20 blur-3xl" />
        </div>

        <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center px-4 py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 text-5xl font-extrabold tracking-tight text-white sm:text-6xl"
          >
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              EquityLens
            </span>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-xl text-sm text-gray-400 sm:text-base"
          >
            Institutional-grade equity research, powered by AI. Understand any stock in seconds.
          </motion.p>

          {/* Search input + chips */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 w-full max-w-2xl"
          >
            <div className="flex flex-col items-stretch gap-3 sm:flex-row">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  $
                </span>
                <input
                  type="text"
                  value={String(query ?? "")}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRun()}
                  placeholder="Search by ticker or company name e.g. Apple, AAPL, Tesla..."
                  className="w-full rounded-full border border-white/10 bg-black/40 px-12 py-4 text-sm text-white shadow-lg outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <button
                onClick={handleRun}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-8 py-4 text-sm font-semibold text-gray-900 shadow-lg transition hover:brightness-110 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                    {loadingMessage || `Analyzing "${String(query ?? "").trim() || "..."}"...`}
                  </>
                ) : (
                  <>
                    Run Analysis
                  </>
                )}
              </button>
            </div>

            {/* Dynamic suggestion chips */}
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-gray-400">
              {suggestionTickers.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleRun(sym)}
                  className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-3">
                {error.toLowerCase().includes("publicly") ? (
                  <div className="mx-auto max-w-md rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-left">
                    <h3 className="mb-2 text-sm font-semibold text-amber-200">
                      Company Not Found on Public Markets
                    </h3>
                    <p className="mb-4 text-xs text-gray-300">{error}</p>
                    <p className="mb-3 text-xs text-gray-400">Try one of these popular stocks:</p>
                    <div className="flex flex-wrap gap-2">
                      {["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "NFLX"].map(
                        (sym) => (
                          <button
                            key={sym}
                            onClick={() => handleRun(sym)}
                            className="rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/30"
                          >
                            {sym}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : notFoundQuery && suggestionTickers.length > 0 ? (
                  <div className="text-xs text-red-400">
                    Could not find '{notFoundQuery}'. Did you mean {suggestionTickers.join(", ")}?
                  </div>
                ) : (
                  <div className="text-xs text-red-400">{error}</div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* RESULTS */}
      <div ref={resultsRef} className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        {loading && !data && <ResearchSkeleton loadingMessage={loadingMessage} />}

        {/* Streaming bottom line - visible while report is being generated */}
        {loading && (isStreaming || streamedText) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5"
          >
            <p className="mb-2 text-sm font-semibold text-blue-200">
              Bottom Line — What should I know?
            </p>
            <p className="text-gray-300 leading-relaxed">
              <span>
                {streamedText}
                {isStreaming && <span className="animate-pulse">|</span>}
              </span>
            </p>
          </motion.div>
        )}
        {/* Company hero card */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 overflow-hidden rounded-2xl border border-[#1e1e2e] bg-gradient-to-r from-[#0b1120] via-[#111827] to-[#1f2933] p-6 shadow-xl"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-bold text-gray-900">
                  {tickerLabel.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xl font-semibold text-white">{companyName}</p>
                    <button
                      onClick={() => exportResearchPDF(data)}
                      className="rounded-lg border border-[#1e1e2e] bg-[#13131f] px-4 py-2 text-xs font-medium text-gray-300 transition hover:border-[#60a5fa]/50 hover:bg-[#1e1e2e] hover:text-white"
                    >
                      Export PDF
                    </button>
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {tickerLabel}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2 text-sm text-gray-300">
                    <span className="text-2xl font-bold text-white">
                      {price != null ? `$${priceDisplay.toFixed(2)}` : "—"}
                    </span>
                    {/* Placeholder for price change — backend can be extended */}
                    <span className="text-xs text-emerald-400">▲</span>
                    <span className="text-xs text-emerald-400">+0.0%</span>
                  </div>
                </div>
              </div>

                <div className="text-right">
                <div
                  className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-gray-900 ${
                    signal === "BUY"
                      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                      : signal === "SELL"
                      ? "bg-gradient-to-r from-red-400 to-red-500"
                      : "bg-gradient-to-r from-amber-400 to-amber-500"
                  }`}
                >
                  {signal}
                </div>
                <p className="mt-2 text-xs text-gray-300">AI Confidence: High</p>

                {/* Mini TradingView chart */}
                <div className="mt-4 h-20 w-48 rounded-lg bg-black/20 p-1">
                  <TradingViewMini ticker={tickerLabel} />
                </div>
              </div>
            </div>

            {/* Risk meter segments */}
            <div className="mt-6">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-300">
                <span>Risk Score: {Math.round(riskDisplay)}/100 — {riskBucket}</span>
              </div>
              <div className="relative mt-1 flex h-2 overflow-hidden rounded-full bg-black/40">
                {["Very Safe", "Safe", "Moderate", "Risky", "Dangerous"].map((label, idx) => {
                  const colors = ["bg-emerald-500", "bg-green-400", "bg-amber-400", "bg-orange-500", "bg-red-500"];
                  return (
                    <div key={label} className={`flex-1 ${colors[idx]} bg-opacity-60`} />
                  );
                })}
                {/* Arrow indicator */}
                <div
                  className="absolute -top-1 h-4 w-0.5 bg-white"
                  style={{ left: `${Math.min(98, Math.max(0, risk))}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                <span>Very Safe</span>
                <span>Safe</span>
                <span>Moderate</span>
                <span>Risky</span>
                <span>Dangerous</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* SECTION 1: Company Profile Card */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-6 overflow-hidden rounded-xl border-2 border-[#06b6d4]/60 bg-[#0a0a0f] p-6 shadow-lg"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">
              About {companyName}
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm leading-relaxed text-gray-300">
                  {data.company_description
                    ? truncateToSentences(data.company_description, 3)
                    : "No company description available."}
                </p>
              </div>
              <div className="grid grid-cols-2 grid-rows-2 gap-3">
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Sector</p>
                  <p className="text-sm font-medium text-white">{data.sector || "—"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Industry</p>
                  <p className="text-sm font-medium text-white">{data.industry || "—"}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Employees</p>
                  <p className="text-sm font-medium text-white">
                    {data.employees != null ? formatEmployees(data.employees) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Country</p>
                  <p className="text-sm font-medium text-white">{data.country || "—"}</p>
                </div>
              </div>
            </div>
            {data.website && (
              <p className="mt-4 border-t border-white/10 pt-4 text-xs text-gray-500">
                <a
                  href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  {data.website.replace(/^https?:\/\//, "")}
                </a>
              </p>
            )}
          </motion.div>
        )}

        {/* SECTION 2: Data Freshness Banner */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-[#0d0d12] px-4 py-3"
          >
            <span className="flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">
              Live Data
            </span>
            <span className="text-xs text-gray-500">|</span>
            <p className="text-xs text-gray-400">
              This report is based on: SEC 10-K filing (filed{" "}
              {data.filing_date || "N/A"}), live market data as of {data.data_as_of || "N/A"}, and
              news from the past 30 days ({data.news_date_range || "N/A"}).
            </p>
          </motion.div>
        )}

        {/* Metrics row */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            {[
              {
                label: "P/E Ratio",
                value: data?.financials?.pe_ratio != null ? formatNum(data.financials.pe_ratio) : "—",
                desc:
                  data?.financials?.pe_ratio != null
                    ? `For every $1 of profit ${companyName} makes, investors pay $${data.financials.pe_ratio.toFixed(0)}. The average S&P 500 stock is ~25.`
                    : "Price relative to earnings.",
                border: "border-t-[3px] border-t-blue-500",
              },
              {
                label: "EPS",
                value: formatEps(data?.financials?.eps),
                desc:
                  data?.financials?.eps != null
                    ? `${companyName} earned $${data.financials.eps.toFixed(2)} for each share of stock last year.`
                    : "Earnings per share.",
                border: "border-t-[3px] border-t-emerald-500",
              },
              {
                label: "Revenue",
                value: formatCurrencyLarge(data?.financials?.revenue),
                desc:
                  data?.financials?.revenue != null
                    ? `${companyName} brought in ${formatLargeNumber(data.financials.revenue)} in total sales last year.`
                    : "Total annual sales.",
                border: "border-t-[3px] border-t-violet-500",
              },
              {
                label: "Profit Margin",
                value: formatMargin(data?.financials?.profit_margin),
                desc:
                  data?.financials?.profit_margin != null
                    ? `For every $100 in sales, ${companyName} keeps $${(data.financials.profit_margin * 100).toFixed(0)} as profit after all expenses.`
                    : "Profit from sales.",
                border: "border-t-[3px] border-t-amber-400",
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-xl border border-[#1e1e2e] bg-[#13131f] p-4 shadow-sm transition hover:border-blue-400/80 ${card.border}`}
              >
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
                <p className="mt-1 text-xs text-gray-400">{card.desc}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* AI Report section */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-8"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  AI Research Report — {companyName}
                </h2>
                <p className="text-xs text-gray-400">
                  Generated using SEC filings, live financials, and news sentiment.
                </p>
              </div>
              <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-300">
                Powered by Llama 3.1
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Financial health */}
              <div className="flex flex-col gap-2 rounded-xl border-l-4 border-cyan-400 border-[#1e1e2e] bg-[#13131f] p-4 hover:border-opacity-100">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <span>Financial Health</span>
                </div>
                <p className="text-xs text-gray-400">
                  Real metrics for {companyName} — what the numbers actually mean.
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-gray-300">
                  {data?.financials?.pe_ratio != null && (
                    <li>
                      P/E {data.financials.pe_ratio.toFixed(1)}: For every $1 of profit{" "}
                      {companyName} makes, investors pay $
                      {data.financials.pe_ratio.toFixed(0)}. Average S&P 500 stock ~25.
                    </li>
                  )}
                  {data?.financials?.profit_margin != null && (
                    <li>
                      Margin {(data.financials.profit_margin * 100).toFixed(1)}%: For every $100 in
                      sales, {companyName} keeps $
                      {(data.financials.profit_margin * 100).toFixed(0)} as profit.
                    </li>
                  )}
                  {data?.financials?.eps != null && (
                    <li>
                      EPS ${data.financials.eps.toFixed(2)}: {companyName} earned $
                      {data.financials.eps.toFixed(2)} per share last year.
                    </li>
                  )}
                  {data?.financials?.revenue != null && (
                    <li>
                      Revenue {formatLargeNumber(data.financials.revenue)}: Total annual sales.
                    </li>
                  )}
                  {(!data?.financials?.pe_ratio &&
                    !data?.financials?.profit_margin &&
                    !data?.financials?.eps) && (
                    <li>Snapshot of profitability, leverage, and cash generation.</li>
                  )}
                </ul>
                <div className="mt-3 inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  Health Score:{" "}
                  {data?.financials?.profit_margin != null && data.financials.profit_margin > 0.15
                    ? "Strong"
                    : data?.financials?.profit_margin != null && data.financials.profit_margin < 0
                    ? "Weak"
                    : "Moderate"}
                </div>
              </div>

              {/* Market Sentiment */}
              <div className="flex flex-col gap-2 rounded-xl border-l-4 border-violet-400 border-[#1e1e2e] bg-[#13131f] p-4 hover:border-opacity-100">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <span>Market Sentiment</span>
                  {(data.sentiment_label ?? "Neutral") && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        (data.sentiment_label ?? "").toLowerCase().includes("bull")
                          ? "bg-emerald-500/20 text-emerald-300"
                          : (data.sentiment_label ?? "").toLowerCase().includes("bear")
                          ? "bg-red-500/20 text-red-300"
                          : "bg-gray-500/20 text-gray-300"
                      }`}
                    >
                      {data.sentiment_label ?? "Neutral"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  AI analysis of current market sentiment for this stock.
                </p>
                {data.sentiment_summary && (
                  <p className="mt-2 text-sm italic text-gray-500">{data.sentiment_summary}</p>
                )}
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-bold ${
                      (data.sentiment_score ?? data.overall_sentiment_score ?? 0) > 0
                        ? "text-emerald-400"
                        : (data.sentiment_score ?? data.overall_sentiment_score ?? 0) < 0
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {((data.sentiment_score ?? data.overall_sentiment_score ?? 0) >= 0 ? "+" : "") +
                      (data.sentiment_score ?? data.overall_sentiment_score ?? 0).toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500">/ 1.0</span>
                  <span
                    className={`ml-2 rounded px-2 py-0.5 text-[10px] font-medium ${
                      (data.sentiment_label ?? "Neutral").toLowerCase().includes("bull")
                        ? "bg-emerald-500/20 text-emerald-300"
                        : (data.sentiment_label ?? "Neutral").toLowerCase().includes("bear")
                        ? "bg-red-500/20 text-red-300"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {data.sentiment_label ?? "Neutral"}
                  </span>
                </div>
                {!data?.news || (Array.isArray(data.news) && data.news.length === 0) ? (
                  <p className="mt-3 text-sm text-gray-500">No headlines available</p>
                ) : (
                  <div className="mt-3">
                    {(data.news || []).slice(0, 5).map((article: any, i: number) => {
                      const sc = article.sentiment_score ?? 0;
                      const dotColor =
                        sc > 0.05 ? "bg-emerald-400" : sc < -0.05 ? "bg-red-400" : "bg-gray-500";
                      const badgeColor =
                        sc > 0.05
                          ? "bg-emerald-500/20 text-emerald-300"
                          : sc < -0.05
                          ? "bg-red-500/20 text-red-300"
                          : "bg-gray-500/20 text-gray-400";
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 py-2 border-b border-[#1e1e2e] last:border-0"
                        >
                          <div
                            className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-200 leading-snug">
                              {article.title || article.description || "No title"}
                            </p>
                            <p className="mt-1">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeColor}`}
                              >
                                {article.sentiment_label ||
                                  (sc > 0.05 ? "Positive" : sc < -0.05 ? "Negative" : "Neutral")}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Risk assessment */}
              <div className="flex flex-col gap-2 rounded-xl border-l-4 border-orange-400 border-[#1e1e2e] bg-[#13131f] p-4 hover:border-opacity-100">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <span>Warning: Risk Assessment</span>
                </div>
                <p className="text-xs text-gray-400">
                  Key risks you should be aware of before investing.
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {Math.round(riskDisplay)}
                  <span className="ml-1 text-xs font-normal text-gray-400">/ 100</span>
                </p>
                <ul className="mt-2 space-y-1 text-xs text-gray-300">
                  <li>• Business concentration or competitive pressure.</li>
                  <li>• Macro or regulatory risks affecting the industry.</li>
                  <li>• Execution risks around strategy and innovation.</li>
                </ul>
              </div>

              {/* AI verdict */}
              <div className="flex flex-col gap-2 rounded-xl border-l-4 border-emerald-400 border-[#1e1e2e] bg-[#13131f] p-4 hover:border-opacity-100">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                  <span>AI Verdict</span>
                </div>
                <p className="text-xs text-gray-400">
                  A simple, plain-English recommendation based on the full analysis.
                </p>
                <p
                  className={`mt-2 text-2xl font-bold ${
                    signal === "BUY"
                      ? "text-emerald-400"
                      : signal === "SELL"
                      ? "text-red-400"
                      : "text-amber-300"
                  }`}
                >
                  {signal}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-gray-300">
                  {(data?.recommendation_reasons ?? []).length > 0 ? (
                    (data.recommendation_reasons as string[]).map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))
                  ) : (
                    <>
                      <li>• Financials and profitability profile.</li>
                      <li>• Recent news and sentiment balance.</li>
                      <li>• Overall risk vs potential reward.</li>
                    </>
                  )}
                </ul>
                <p className="mt-3 text-xs text-gray-400">
                  What this means for you: this is a high-level guide, not a guarantee. Use it to frame
                  your own research and risk tolerance.
                </p>
                <p className="mt-3 text-[10px] text-gray-500">
                  This is AI-generated research for educational purposes only. Not financial advice.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Bull Case / Bear Case — fields returned at top level */}
        {data && data.bull_case && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.33 }}
            className="mb-8"
          >
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.bull_case && (
                <div className="rounded-xl border border-[#1e1e2e] border-l-4 border-l-emerald-500 bg-[#13131f] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-bold uppercase tracking-wide text-emerald-400">
                      Bull Case
                    </span>
                    <span className="text-lg text-emerald-400">↑</span>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-gray-300">
                    {data.bull_case}
                  </p>
                  {data.price_target != null && (
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-2">
                      <span className="text-sm font-semibold text-emerald-400">
                        Target: ${Number(data.price_target).toFixed(2)}{" "}
                        (+{(data.price_target_upside ?? 0).toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}
              {data.bear_case && (
                <div className="rounded-xl border border-[#1e1e2e] border-l-4 border-l-red-500 bg-[#13131f] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-bold uppercase tracking-wide text-red-400">
                      Bear Case
                    </span>
                    <span className="text-lg text-red-400">↓</span>
                  </div>
                  <p className="mb-3 text-sm leading-relaxed text-gray-300">
                    {data.bear_case}
                  </p>
                  <div className="rounded-lg bg-red-500/10 px-3 py-2">
                    <span className="text-sm font-semibold text-red-400">
                      Downside risk if bear case plays out
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Price Target Card */}
            {data.price_target != null && (
              <div className="mb-6 rounded-xl border border-[#1e1e2e] bg-[#13131f] p-5 text-center">
                <p className="mb-3 text-xs uppercase tracking-wide text-gray-500">
                  12-Month Price Target
                </p>
                <div className="flex flex-wrap items-center justify-center gap-6">
                  <div>
                    <p className="text-xs text-gray-500">Current</p>
                    <p className="text-2xl font-bold text-white">
                      ${Number(data.financials?.current_price ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-2xl text-gray-500">→</span>
                  <div>
                    <p className="text-xs text-gray-500">Target</p>
                    <p
                      className={`text-2xl font-bold ${
                        (data.price_target_upside ?? 0) >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      ${Number(data.price_target).toFixed(2)}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      (data.price_target_upside ?? 0) >= 0
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {(data.price_target_upside ?? 0) >= 0 ? "+" : ""}
                    {(data.price_target_upside ?? 0).toFixed(1)}%
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Based on AI analysis of fundamentals and market conditions
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Investment Calculator */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mb-8 rounded-xl border-2 border-amber-500/50 bg-amber-500/5 p-6"
          >
            <h2 className="mb-4 text-lg font-semibold text-white">
              Investment Calculator — {companyName}
            </h2>
            <InvestmentCalculator
              price={data?.financials?.current_price ?? 0}
              recommendation={signal}
            />
          </motion.div>
        )}

        {/* Plain English bottom line */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5"
          >
            <p className="mb-2 text-sm font-semibold text-blue-200">
              Bottom Line — What should I know?
            </p>
            <div className="text-gray-300 leading-relaxed">
              {isStreaming ? (
                <span>
                  {streamedText}
                  <span className="animate-pulse">|</span>
                </span>
              ) : (
                data.plain_english_summary ||
                data.plain_summary ||
                streamedText ||
                `${companyName} appears financially ${
                  risk < 33 ? "strong" : risk <= 66 ? "healthy with some risks" : "riskier"
                }. Our AI rates this as ${signal}. Consider your time horizon and risk tolerance.`
              )}
            </div>
          </motion.div>
        )}

        {/* Disclaimer */}
        <div className="mb-8 text-[10px] text-gray-500">
          AI-generated research for educational purposes only. Not financial advice. Always do your own
          research and consider speaking with a licensed financial professional.
        </div>
      </div>
    </div>
  );
}
