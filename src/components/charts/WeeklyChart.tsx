"use client";
import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import {
  AreaChart,
  Area,
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
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-md min-w-[150px]">
        <p className="text-sm font-semibold text-slate-800 mb-2 pb-2 border-b border-slate-100">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-600 capitalize">{entry.name}</span>
              </div>
              <span className="text-slate-900 font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Days to exclude from the chart (0 = Sunday). Matches server-side WEEKEND_DAYS.
const CHART_WEEKEND_DAYS = new Set([0]);

export default function WeeklyChart({ chartData: initialData }: { chartData?: any[] }) {
  const [data, setData] = useState<any[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData || initialData.length === 0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/dashboard/analytics');
        if (res.data) {
          setData(res.data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch real-time chart data", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Defensive client-side weekend filter ─────────────────────────────────
  // Removes any Sunday (or configured weekend day) entries that may have slipped
  // through from an older API response or a stale cache.
  const filteredData = (data || []).filter(day => {
    // If the API already sends dayOfWeek use it; otherwise re-derive from the
    // three-letter label ("Sun" → skip).
    if (typeof day.dayOfWeek === 'number') {
      return !CHART_WEEKEND_DAYS.has(day.dayOfWeek);
    }
    // Fallback: label-based filter for safety
    const WEEKEND_LABELS = new Set(['Sun']);
    return !WEEKEND_LABELS.has(day.date);
  });
  // ─────────────────────────────────────────────────────────────────────────;

  if (loading) {
    return (
      <div className="w-full h-[320px] bg-slate-100/50 dark:bg-slate-800/20 animate-pulse rounded-xl flex items-center justify-center">
        <span className="text-slate-400 text-sm">Loading Live Data...</span>
      </div>
    );
  }

  if (!filteredData || filteredData.length === 0) {
    return <div className="flex h-[320px] items-center justify-center text-gray-400">No chart data available</div>;
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={filteredData}
          margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#e5e7eb"
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
            verticalAlign="top"
            align="left"
            iconType="circle"
            wrapperStyle={{ fontSize: "11px", paddingBottom: "20px" }}
            formatter={(value) => <span className="text-slate-600 font-medium capitalize ml-2 mr-4">{value}</span>}
          />
          <Area
            type="linear"
            dataKey="present"
            name="present"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorPresent)"
            strokeWidth={2}
            activeDot={{ r: 5, strokeWidth: 0, fill: "#10b981" }}
          />
          <Area
            type="linear"
            dataKey="absent"
            name="absent"
            stroke="#f43f5e"
            fillOpacity={1}
            fill="url(#colorAbsent)"
            strokeWidth={2}
            activeDot={{ r: 5, strokeWidth: 0, fill: "#f43f5e" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
