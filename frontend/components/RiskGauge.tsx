"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

interface RiskGaugeProps {
  value: number; // 0-100
  className?: string;
}

export default function RiskGauge({ value, className = "" }: RiskGaugeProps) {
  const color = value < 35 ? "#22c55e" : value < 65 ? "#eab308" : "#ef4444";
  const data = [
    { name: "risk", value: Math.min(100, Math.max(0, value)), fill: color },
  ];

  return (
    <div
      className={`rounded-xl border border-border bg-card p-4 opacity-0 animate-fade-in ${className}`}
      style={{ backgroundColor: "#13131f" }}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
        Risk Score
      </p>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="70%"
            innerRadius="40%"
            outerRadius="100%"
            barSize={12}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background
              dataKey="value"
              cornerRadius={6}
              fill={color}
              max={100}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
