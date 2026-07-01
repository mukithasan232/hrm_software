"use client";
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function WeeklyChart({ chartData }: { chartData: any[] }) {
  if (!chartData || chartData.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-400">No chart data available</div>;
  }

  return (
    <div className="w-full h-72 min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 0, left: -20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#cbd5e1"
            opacity={0.2}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fontWeight: 600 }}
            stroke="#94a3b8"
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <RechartsTooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            contentStyle={{
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: "12px",
            }}
            formatter={(value: any, name: any) => [
              value,
              name === "present" ? "Present ✅" : "Absent ❌",
            ]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value) =>
              value === "present" ? "Present" : "Absent"
            }
          />
          <Bar
            dataKey="present"
            name="present"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            barSize={18}
          />
          <Bar
            dataKey="absent"
            name="absent"
            fill="#f43f5e"
            radius={[4, 4, 0, 0]}
            barSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
