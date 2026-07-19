'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import type { RankedGate } from '@/types/csv';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface TimeSeriesChartProps {
  rankedGates: RankedGate[];
}

export function TimeSeriesChart({ rankedGates }: TimeSeriesChartProps) {
  const data = useMemo(() => {
    // Only use gates that actually have a timestamp
    const withTime = rankedGates
      .filter(rg => rg.gate.timestamp !== undefined)
      .map(rg => ({
        name: rg.gate.gate,
        time: rg.gate.timestamp,
        queue: rg.gate.queueLength,
        visitors: rg.gate.currentVisitors
      }))
      .sort((a, b) => {
        // Simple string sort assuming ISO 8601 or HH:mm formats.
        if (!a.time || !b.time) return 0;
        return a.time.localeCompare(b.time);
      });
      
    return withTime;
  }, [rankedGates]);

  if (data.length === 0) {
    return null; // Don't render anything if no timestamp data exists
  }

  return (
    <Card className="col-span-1 shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center">
          Event Timeline
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
          Queue length over recorded time intervals
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        {data.length < 2 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400" />
            <p>Insufficient time series data to plot a trend.</p>
          </div>
        ) : (
          <>
            <div 
              className="h-full w-full" 
              role="img" 
              aria-label="Line chart showing queue length trends over time"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="queue" 
                    name="Queue Length"
                    stroke="#3b82f6" // blue-500
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Queue Length Trends Over Time</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Gate</th>
                  <th scope="col">Queue Length</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    <td>{row.time}</td>
                    <td>{row.name}</td>
                    <td>{row.queue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
