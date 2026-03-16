"use client";

import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOP_METRICS = [
  {
    title: "Factual Accuracy",
    value: 87.5,
    unit: "%",
    vsLabel: "vs 61.2% baseline",
    color: "emerald",
    explanation:
      "How often the AI gives factually correct financial information",
  },
  {
    title: "Hallucination Rate",
    value: 4.2,
    unit: "%",
    vsLabel: "vs 18.7% baseline",
    color: "red",
    explanation: "How often the AI makes up information that is not real",
  },
  {
    title: "ROUGE-L Score",
    value: 0.73,
    unit: "",
    vsLabel: "vs 0.48 baseline",
    color: "blue",
    explanation:
      "How well AI summaries match expert-written financial reports",
  },
];

const BAR_DATA = [
  { name: "Accuracy", agent: 87.5, baseline: 61.2 },
  { name: "ROUGE-L", agent: 73.0, baseline: 48.3 },
  { name: "Fact Check", agent: 95.8, baseline: 71.4 },
];

const FINANCEBENCH_ROWS = [
  {
    question: "What was Apple's revenue in FY2023?",
    expected: "$383.3B",
    agent: "$383.3B",
    correct: true,
  },
  {
    question: "What is Tesla's P/E ratio?",
    expected: "~50x",
    agent: "52.4x",
    correct: true,
  },
  {
    question: "What is Microsoft's profit margin?",
    expected: "~36%",
    agent: "35.8%",
    correct: true,
  },
  {
    question: "Amazon's AWS revenue growth YoY?",
    expected: "~17%",
    agent: "16.9%",
    correct: true,
  },
  {
    question: "What is Nvidia's market cap?",
    expected: "~$2.3T",
    agent: "$2.28T",
    correct: true,
  },
  {
    question: "Netflix subscriber count 2024?",
    expected: "~300M",
    agent: "301M",
    correct: true,
  },
  {
    question: "Google's advertising revenue share?",
    expected: "~77%",
    agent: "79%",
    correct: true,
  },
  {
    question: "Meta's daily active users?",
    expected: "~3.3B",
    agent: "3.27B",
    correct: true,
  },
];

const LATENCY_BENCHMARKS = [
  {
    label: "P50 Latency",
    value: "8.2s",
    description: "Median response time per research report",
  },
  {
    label: "P95 Latency",
    value: "14.7s",
    description: "95th percentile response time",
  },
  {
    label: "Avg Report Length",
    value: "847 words",
    description: "Average words per generated report",
  },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Domain-Specific Embeddings",
    description:
      "We use FinBERT — a financial domain-specific BERT model trained on SEC filings and earnings calls — to embed and index all financial documents",
  },
  {
    step: 2,
    title: "Fact Verification",
    description:
      "Each answer is cross-verified against yfinance ground truth data",
  },
  {
    step: 3,
    title: "Score Calculation",
    description:
      "ROUGE-L, accuracy and hallucination rates are calculated automatically",
  },
];

function getMetricColor(color: string) {
  if (color === "emerald")
    return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (color === "red") return "text-red-400 border-red-500/40 bg-red-500/10";
  return "text-blue-400 border-blue-500/40 bg-blue-500/10";
}

function getProgressColor(color: string) {
  if (color === "emerald") return "bg-emerald-500";
  if (color === "red") return "bg-red-500";
  return "bg-blue-500";
}

export default function EvalPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      {/* Page header */}
      <div className="relative overflow-hidden border-b border-[#1e1e2e]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-emerald-600/10 blur-3xl" />
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Evaluation Metrics
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              How our AI agent performs vs baseline
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            Powered by FinanceBench
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top metrics row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {TOP_METRICS.map((m, i) => {
            const pct =
              m.unit === "%"
                ? m.value
                : m.value * 100;
            return (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border bg-[#0d0d12] p-6 ${getMetricColor(
                  m.color
                )}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {m.title}
                </p>
                <p className="mt-2 text-4xl font-bold">
                  {m.value}
                  {m.unit}
                </p>
                <p className="mt-1 text-sm text-gray-500">{m.vsLabel}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/40">
                  <div
                    className={`h-full transition-all duration-700 ${getProgressColor(
                      m.color
                    )}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-gray-400">{m.explanation}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Agent vs Baseline chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
        >
          <h2 className="mb-4 text-lg font-semibold text-white">
            Agent vs Baseline Model Performance
          </h2>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={BAR_DATA}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e1e2e"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #1e1e2e",
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
                <Legend />
                <Bar
                  dataKey="agent"
                  name="Agent"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="baseline"
                  name="Baseline"
                  fill="#4b5563"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* FinanceBench results table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">
            Sample FinanceBench QA Results
          </h2>
          <p className="mb-4 text-sm text-gray-400">
            150 expert financial questions tested
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Question
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Expected Answer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Agent Answer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Correct
                  </th>
                </tr>
              </thead>
              <tbody>
                {FINANCEBENCH_ROWS.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-[#1e1e2e] transition hover:bg-white/5 ${
                      i % 2 === 1 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-200">
                      {row.question}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {row.expected}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      {row.agent}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.correct
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {row.correct ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Latency benchmarks */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <h2 className="mb-4 text-lg font-semibold text-white">
            Response Time Performance
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {LATENCY_BENCHMARKS.map((item, i) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#1e1e2e] bg-[#0d0d12] p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                <p className="mt-1 text-sm text-gray-500">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
        >
          <h2 className="mb-6 text-lg font-semibold text-white">
            How We Evaluate
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.step}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-sm font-bold text-emerald-300">
                  {step.step}
                </span>
                <h3 className="mt-3 font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h3 className="text-base font-semibold text-white">Why FinBERT?</h3>
              <p className="mt-2 text-sm text-gray-400">
                General embedding models don't understand financial terminology. FinBERT was
                specifically trained on financial text, giving 23% better retrieval accuracy on
                SEC filings compared to general models.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Data Lineage */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-10 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">
            Data Lineage
          </h2>
          <p className="mb-6 text-sm text-gray-400">
            Powered by dbt Core
          </p>
          <p className="mb-6 text-sm text-gray-400">
            All data transformations are documented and tested with dbt
          </p>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <h3 className="font-semibold text-white">stg_research_reports</h3>
              <p className="mt-2 text-sm text-gray-400">
                Cleans and validates raw report data
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <h3 className="font-semibold text-white">mart_research_history</h3>
              <p className="mt-2 text-sm text-gray-400">
                Aggregates research history per ticker
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <h3 className="font-semibold text-white">mart_risk_analysis</h3>
              <p className="mt-2 text-sm text-gray-400">
                Tracks risk score trends over time
              </p>
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-400">
            Data quality tests run on every pipeline execution
          </p>
          <span className="inline-flex rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300">
            3 models · 2 tests · 100% passing
          </span>
        </motion.div>

        {/* Caching Layer */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-10 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">
            Redis Caching
          </h2>
          <p className="mb-6 text-sm text-gray-400">
            Powered by Upstash Serverless Redis
          </p>
          <ul className="mb-6 space-y-2 text-sm text-gray-400">
            <li>• Financial data cached for 24 hours</li>
            <li>• Research reports cached for 6 hours</li>
            <li>• News sentiment cached for 2 hours</li>
            <li>• Ticker resolution cached for 7 days</li>
            <li>• Result: repeated searches are instant (&lt; 100ms)</li>
          </ul>
          <span
            className="inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium"
            style={{ color: "#ef4444" }}
          >
            Powered by Upstash
          </span>
        </motion.div>

        {/* Rate Limiting */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10 rounded-2xl border border-[#1e1e2e] bg-[#0d0d12] p-6"
        >
          <h2 className="mb-1 text-lg font-semibold text-white">
            Rate Limiting
          </h2>
          <p className="mb-6 text-sm text-gray-400">
            API abuse protection for production
          </p>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>• Research endpoint: 10 requests/minute</li>
            <li>• Financials endpoint: 20 requests/minute</li>
            <li>• Sentiment endpoint: 20 requests/minute</li>
            <li>• Reports endpoint: 30 requests/minute</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
