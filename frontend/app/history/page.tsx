"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deleteReport, getReports } from "@/lib/api";

interface ReportRow {
  id: number;
  ticker: string;
  company_name: string;
  risk_score: number | null;
  recommendation: string;
  price: number | null;
  created_at: string;
  created_at_formatted?: string;
}

type FilterKey = "All" | "Buy" | "Hold" | "Sell";
type SortKey = "Latest" | "Oldest" | "Highest Risk" | "Lowest Risk";

function formatPrice(p: number | null | undefined): string {
  if (p == null) return "—";
  return "$" + Number(p).toFixed(2);
}

function downloadCsv(reports: ReportRow[]) {
  const headers = [
    "ID",
    "Ticker",
    "Company",
    "Risk Score",
    "Recommendation",
    "Price",
    "Created At",
  ];
  const rows = reports.map((r) => [
    r.id,
    r.ticker,
    r.company_name || r.ticker,
    r.risk_score ?? "",
    r.recommendation || "",
    r.price ?? "",
    r.created_at_formatted || r.created_at || "",
  ]);
  const csv =
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "research-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("All");
  const [sort, setSort] = useState<SortKey>("Latest");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteReport(id);
        setReports((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    },
    []
  );

  const filteredAndSorted = useMemo(() => {
    let list = [...reports];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (r.company_name || "").toLowerCase().includes(q) ||
          (r.ticker || "").toLowerCase().includes(q)
      );
    }

    const rec = (r: ReportRow) => (r.recommendation || "").toUpperCase();
    if (filter === "Buy") list = list.filter((r) => rec(r) === "BUY");
    else if (filter === "Hold") list = list.filter((r) => rec(r) === "HOLD");
    else if (filter === "Sell") list = list.filter((r) => rec(r) === "SELL");

    if (sort === "Latest")
      list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    else if (sort === "Oldest")
      list.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    else if (sort === "Highest Risk")
      list.sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
    else if (sort === "Lowest Risk")
      list.sort((a, b) => (a.risk_score ?? 0) - (b.risk_score ?? 0));

    return list;
  }, [reports, search, filter, sort]);

  const stats = useMemo(() => {
    const buy = reports.filter((r) => (r.recommendation || "").toUpperCase() === "BUY").length;
    const hold = reports.filter((r) => (r.recommendation || "").toUpperCase() === "HOLD").length;
    const sell = reports.filter((r) => (r.recommendation || "").toUpperCase() === "SELL").length;
    return { total: reports.length, buy, hold, sell };
  }, [reports]);

  const getRiskColor = (risk: number | null) => {
    if (risk == null) return "bg-gray-500";
    if (risk < 33) return "bg-emerald-500";
    if (risk < 67) return "bg-amber-500";
    return "bg-red-500";
  };

  const getRecClass = (rec: string) => {
    const r = (rec || "").toUpperCase();
    if (r === "BUY") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    if (r === "SELL") return "bg-red-500/20 text-red-300 border-red-500/40";
    return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      <div className="relative overflow-hidden border-b border-[#1e1e2e]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-amber-600/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Research History</h1>
              <p className="mt-1 text-sm text-gray-400">
                Your previously analyzed stocks
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => downloadCsv(filteredAndSorted)}
                disabled={filteredAndSorted.length === 0}
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
              >
                Export CSV
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        {reports.length > 0 && (
          <>
            {/* Summary stats */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
            >
              <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d12] p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Total Researches
                </p>
                <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/40 bg-[#0d0d12] p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Buy Signals
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.buy}</p>
              </div>
              <div className="rounded-xl border border-amber-500/40 bg-[#0d0d12] p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Hold Signals
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-400">{stats.hold}</p>
              </div>
              <div className="rounded-xl border border-red-500/40 bg-[#0d0d12] p-4">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Sell Signals
                </p>
                <p className="mt-1 text-2xl font-bold text-red-400">{stats.sell}</p>
              </div>
            </motion.div>

            {/* Search and filter */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by company or ticker…"
                  className="max-w-xs rounded-lg border border-[#1e1e2e] bg-[#0d0d12] px-4 py-2.5 text-sm text-white outline-none transition focus:border-amber-500"
                />
                <div className="flex gap-1">
                  {(["All", "Buy", "Hold", "Sell"] as FilterKey[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        filter === f
                          ? "bg-amber-500 text-gray-900"
                          : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-lg border border-[#1e1e2e] bg-[#0d0d12] px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="Latest">Latest</option>
                  <option value="Oldest">Oldest</option>
                  <option value="Highest Risk">Highest Risk</option>
                  <option value="Lowest Risk">Lowest Risk</option>
                </select>
              </div>
            </motion.div>
          </>
        )}

        {/* Table or empty state */}
        <AnimatePresence>
          {reports.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] py-20 text-center"
            >
              <p className="text-lg font-medium text-white">No research history yet</p>
              <p className="mt-2 max-w-md text-sm text-gray-400">
                Search for a stock on the Research page to get started
              </p>
              <Link
                href="/research"
                className="mt-6 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-gray-900 transition hover:bg-amber-400"
              >
                Go to Research
              </Link>
            </motion.div>
          )}

          {filteredAndSorted.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-[#1e1e2e] bg-[#0d0d12]"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#1e1e2e] bg-black/20">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Risk
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Recommendation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.map((row, i) => (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className={`border-b border-[#1e1e2e] transition hover:bg-white/5 ${
                          i % 2 === 1 ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {row.company_name || row.ticker}
                            </span>
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
                              {row.ticker}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {row.created_at_formatted || row.created_at?.slice(0, 19).replace("T", " ") || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-black/40">
                              <div
                                className={`h-full ${getRiskColor(row.risk_score)}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, row.risk_score ?? 0))}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-white">
                              {row.risk_score != null
                                ? row.risk_score.toFixed(0)
                                : "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRecClass(
                              row.recommendation
                            )}`}
                          >
                            {row.recommendation || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {formatPrice(row.price)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/research?ticker=${encodeURIComponent(row.ticker)}`}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
                            >
                              View Report
                            </Link>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 p-1.5 text-red-400 transition hover:bg-red-500/20"
                              title="Delete"
                            >
                              <span className="text-sm font-bold">X</span>
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reports.length > 0 && filteredAndSorted.length === 0 && (
                <p className="px-4 py-8 text-center text-gray-500">
                  No reports match your filters
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
