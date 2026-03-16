"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TradingViewMini from "@/components/TradingViewMini";
import { addToWatchlist, getWatchlist, removeFromWatchlist } from "@/lib/api";

type WatchlistItem = {
  ticker: string;
  company_name: string;
  exchange?: string;
  added_price: number | null;
  added_at: string;
  current_price: number | null;
  change_percent: number | null;
  gain_abs: number | null;
  gain_pct: number | null;
};

const POPULAR = ["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA"];

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  return "$" + Number(p).toFixed(2);
}

function formatPct(p: number | null | undefined): string {
  if (p == null || Number.isNaN(Number(p))) return "—";
  const n = Number(p);
  const prefix = n >= 0 ? "+" : "";
  return `${prefix}${n.toFixed(2)}%`;
}

function formatGain(abs: number | null | undefined, pct: number | null | undefined): string {
  if (abs == null || pct == null) return "—";
  const a = Number(abs);
  const p = Number(pct);
  const sign = a >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(a).toFixed(2)} (${sign}${Math.abs(p).toFixed(2)}%)`;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await getWatchlist();
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      load();
    }, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const handleAdd = useCallback(
    async (sym?: string) => {
      const t = String(sym ?? ticker).trim().toUpperCase();
      if (!t) {
        setError("Please enter a ticker.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        await addToWatchlist(t);
        setTicker("");
        setAdding(false);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add stock");
      } finally {
        setLoading(false);
      }
    },
    [ticker, load]
  );

  const handleRemove = useCallback(
    async (sym: string) => {
      setError(null);
      setLoading(true);
      try {
        await removeFromWatchlist(sym);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove stock");
      } finally {
        setLoading(false);
      }
    },
    [load]
  );

  const summary = useMemo(() => {
    const total = items.length;
    const gainers = items.filter((i) => (i.change_percent ?? 0) > 0).length;
    const losers = items.filter((i) => (i.change_percent ?? 0) < 0).length;
    const sorted = [...items].sort((a, b) => (b.change_percent ?? -999) - (a.change_percent ?? -999));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    return {
      total,
      gainers,
      losers,
      best,
      worst,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      <div className="relative overflow-hidden border-b border-[#1e1e2e]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#14b8a6]/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-white sm:text-4xl"
              >
                My Watchlist
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-1 text-sm text-gray-400"
              >
                Track your favorite stocks
              </motion.p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdding((v) => !v)}
                className="rounded-xl bg-[#14b8a6] px-5 py-3 text-sm font-semibold text-gray-900 shadow-lg transition hover:brightness-110"
              >
                Add Stock
              </button>
            </div>
          </div>

          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-6 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      $
                    </span>
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      placeholder="Search ticker or company e.g. AAPL, Apple..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-3.5 pl-11 pr-4 text-white outline-none transition focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/30"
                    />
                  </div>
                  <button
                    onClick={() => handleAdd()}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-xl bg-[#13131f] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:border-[#14b8a6]/50 hover:bg-white/5 disabled:opacity-50"
                  >
                    Add to Watchlist
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {POPULAR.map((sym) => (
                    <button
                      key={sym}
                      onClick={() => handleAdd(sym)}
                      className="rounded-full border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-3 py-1.5 text-xs font-medium text-[#7ef0e5] transition hover:border-[#14b8a6] hover:bg-[#14b8a6]/20"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">
                    Total stocks watching
                  </p>
                  <p className="mt-1 text-2xl font-bold text-white">{summary.total}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Gainers today</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-400">{summary.gainers}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Losers today</p>
                  <p className="mt-1 text-2xl font-bold text-red-400">{summary.losers}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Best performer</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {summary.best ? `${summary.best.ticker} ${formatPct(summary.best.change_percent)}` : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Worst performer</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {summary.worst ? `${summary.worst.ticker} ${formatPct(summary.worst.change_percent)}` : "—"}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {items.length === 0 && !loading ? (
          <div className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-10 text-center">
            <p className="text-xl font-semibold text-white">Your watchlist is empty</p>
            <p className="mt-2 text-sm text-gray-400">
              Add stocks you want to keep an eye on
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {POPULAR.map((sym) => (
                <button
                  key={sym}
                  onClick={() => handleAdd(sym)}
                  className="rounded-full border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-4 py-2 text-sm font-medium text-[#7ef0e5] transition hover:border-[#14b8a6] hover:bg-[#14b8a6]/20"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {items.map((it) => {
                const upToday = (it.change_percent ?? 0) >= 0;
                const upSinceAdded = (it.gain_abs ?? 0) >= 0;
                return (
                  <motion.div
                    key={it.ticker}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="group rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-5 shadow-lg transition hover:border-[#14b8a6]/40 hover:shadow-[0_0_0_1px_rgba(20,184,166,0.25),0_20px_60px_-30px_rgba(20,184,166,0.45)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-white">
                          {it.company_name || it.ticker}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-full bg-[#14b8a6]/15 px-2.5 py-0.5 text-xs font-medium text-[#7ef0e5]">
                            {it.ticker}
                          </span>
                          <span className="text-xs text-gray-500">{it.exchange || "NASDAQ"}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">{formatPrice(it.current_price)}</p>
                        <p className={`mt-1 text-xs font-medium ${upToday ? "text-emerald-400" : "text-red-400"}`}>
                          {formatPct(it.change_percent)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
                      <TradingViewMini ticker={it.ticker} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Added price</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatPrice(it.added_price)}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500">Since added</p>
                        <p className={`mt-1 text-sm font-semibold ${upSinceAdded ? "text-emerald-400" : "text-red-400"}`}>
                          {formatGain(it.gain_abs, it.gain_pct)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/research?ticker=${encodeURIComponent(it.ticker)}`}
                        className="flex-1 rounded-xl bg-[#14b8a6] px-4 py-2.5 text-center text-sm font-semibold text-gray-900 transition hover:brightness-110"
                      >
                        Research
                      </Link>
                      <button
                        onClick={() => handleRemove(it.ticker)}
                        className="rounded-xl border border-white/10 bg-[#13131f] px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

