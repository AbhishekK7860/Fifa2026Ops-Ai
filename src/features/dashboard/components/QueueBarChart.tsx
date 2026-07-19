'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { RankedGate } from '@/types/csv';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface QueueBarChartProps {
  rankedGates: RankedGate[];
}

export function QueueBarChart({ rankedGates }: QueueBarChartProps) {
  const data = useMemo(() => {
    return rankedGates.map(rg => ({
      name: rg.gate.gate,
      queue: rg.gate.queueLength,
      status: rg.gate.status,
    }));
  }, [rankedGates]);

  const OUTLIER_THRESHOLD = 100000;
  const hasOutliers = data.some(d => d.queue > OUTLIER_THRESHOLD);

  const getBarColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'normal': return '#10b981'; // emerald-500
      case 'busy': return '#f59e0b'; // amber-500
      case 'critical': return '#f43f5e'; // rose-500
      default: return '#94a3b8'; // slate-400
    }
  };

  return (
    <Card className="col-span-1 shadow-sm h-full flex flex-col border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Queue Length Distribution
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
          Current queue sizes across all active gates
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        {/* Recharts Container with explicit ARIA labeling for accessibility */}
        <div 
          className="h-[250px] w-full mt-4" 
          role="img" 
          aria-label="Bar chart showing queue lengths for each gate"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                // Using a log scale if there are massive outliers to keep chart readable
                scale={hasOutliers ? 'log' : 'auto'} 
                domain={hasOutliers ? [1, 'auto'] : [0, 'auto']}
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
              />
              
              {/* Outlier Threshold Line */}
              <ReferenceLine 
                y={OUTLIER_THRESHOLD} 
                stroke="#ef4444" 
                strokeDasharray="3 3" 
                label={{ position: 'top', value: 'Outlier Threshold', fill: '#ef4444', fontSize: 12 }} 
              />
              
              <Bar dataKey="queue" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Visually hidden accessible data table */}
        <table className="sr-only">
          <caption>Queue Lengths by Gate</caption>
          <thead>
            <tr>
              <th scope="col">Gate</th>
              <th scope="col">Queue Length</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.queue}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
