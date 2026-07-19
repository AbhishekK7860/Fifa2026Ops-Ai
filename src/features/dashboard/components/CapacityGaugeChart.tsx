'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { GateRow } from '@/types/csv';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface CapacityGaugeChartProps {
  gate: GateRow | null;
}

export function CapacityGaugeChart({ gate }: CapacityGaugeChartProps) {
  const { data, percentage } = useMemo(() => {
    if (!gate) return { data: [], percentage: 0 };
    
    const visitors = gate.currentVisitors;
    const capacity = gate.capacity;
    const available = Math.max(0, capacity - visitors);
    const overCapacity = Math.max(0, visitors - capacity);
    
    // Calculate percentage (capped at 100 for gauge display math, but we show actual in text)
    const pct = capacity > 0 ? Math.round((visitors / capacity) * 100) : 0;

    let chartData = [];
    if (overCapacity > 0) {
      chartData = [
        { name: 'Capacity Met', value: capacity, color: '#f59e0b' }, // amber
        { name: 'Over Capacity', value: overCapacity, color: '#f43f5e' } // rose
      ];
    } else {
      chartData = [
        { name: 'Current Visitors', value: visitors, color: '#10b981' }, // emerald
        { name: 'Available Space', value: available, color: '#e2e8f0' } // slate-200
      ];
    }

    return { data: chartData, percentage: pct };
  }, [gate]);

  if (!gate) {
    return (
      <Card className="col-span-1 shadow-sm h-full flex flex-col border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 justify-center items-center">
        <p className="text-slate-400 text-sm">Select a gate to view capacity.</p>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 shadow-sm h-full flex flex-col border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Capacity Utilization
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
          {gate.gate} occupancy status
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] flex flex-col items-center justify-center relative">
        <div 
          className="h-[200px] w-full" 
          role="img" 
          aria-label={`Gauge chart showing ${percentage}% capacity utilization for ${gate.gate}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                cornerRadius={4}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: '500' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Absolute positioned center text for the gauge */}
        <div className="absolute bottom-6 flex flex-col items-center">
          <span className={`text-3xl font-extrabold ${percentage >= 100 ? 'text-rose-600 dark:text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}>
            {percentage}%
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Utilized
          </span>
        </div>

        {/* Visually hidden accessible data table */}
        <table className="sr-only">
          <caption>Capacity details for {gate.gate}</caption>
          <tbody>
            <tr>
              <th scope="row">Current Visitors</th>
              <td>{gate.currentVisitors}</td>
            </tr>
            <tr>
              <th scope="row">Total Capacity</th>
              <td>{gate.capacity}</td>
            </tr>
            <tr>
              <th scope="row">Utilization Percentage</th>
              <td>{percentage}%</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
