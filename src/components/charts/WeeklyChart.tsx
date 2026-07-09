"use client";
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-lg min-w-[150px]">
        <p className="text-sm font-semibold text-slate-800 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-600 dark:text-slate-400 capitalize">{entry.name}</span>
              </div>
              <span className="text-slate-900 dark:text-white font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function WeeklyChart({ chartData }: { chartData: any[] }) {
  if (!chartData || chartData.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-400">No chart data available</div>;
  }

  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
        >
          <CartesianGrid
            stroke="#94a3b8"
            strokeOpacity={0.15}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fontWeight: 500, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis
            tick={{ fontSize: 11, fontWeight: 500, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            dx={-10}
          />
          <RechartsTooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "11px", paddingTop: "20px" }}
            formatter={(value) => <span className="text-slate-600 dark:text-slate-400 font-medium capitalize ml-1">{value}</span>}
          />
          <Line
            type="linear"
            dataKey="present"
            name="present"
            stroke="#10b981"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
          />
          <Line
            type="linear"
            dataKey="absent"
            name="absent"
            stroke="#f43f5e"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 0, fill: "#f43f5e" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
