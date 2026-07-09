"use client";
import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export default function DepartmentChart({ 
  departmentData, 
  COLORS, 
  totalEmployees 
}: { 
  departmentData: any[], 
  COLORS: string[], 
  totalEmployees: number 
}) {
  if (!departmentData || departmentData.length === 0) {
    return <div className="flex h-full items-center justify-center text-gray-400">No chart data available</div>;
  }

  const safeData = departmentData.map(d => ({
    ...d,
    name: typeof d.name === 'object' ? d.name?.name : d.name || 'Unassigned'
  }));

  return (
    <div className="w-full relative h-72 min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={safeData}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {safeData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            itemStyle={{ color: "#1e293b", fontWeight: "bold" }}
          />
          <Legend
            iconType="circle"
            layout="horizontal"
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none pb-4">
        <span className="text-3xl font-bold text-slate-800 dark:text-white">
          {totalEmployees}
        </span>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
          Total
        </span>
      </div>
    </div>
  );
}
