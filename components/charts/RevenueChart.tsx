'use client';

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { formatCompactINR } from '@/lib/utils';

interface RevenueChartProps {
  data: { month: string; income: number; expense: number }[];
  height?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 shadow-[var(--shadow-elevated)]">
      <p className="text-[11px] font-medium text-[var(--text-primary)] mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-[11px] text-[var(--text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: entry.color }} />
          {entry.name}: {formatCompactINR(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueChart({ data, height = 220 }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          tickFormatter={(v) => formatCompactINR(v)}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)', radius: 4 }} />
        <Bar dataKey="income" fill="var(--accent-green)" radius={[4, 4, 0, 0]} maxBarSize={28} name="Income" />
        <Bar dataKey="expense" fill="var(--accent-red)" radius={[4, 4, 0, 0]} maxBarSize={28} name="Expense" />
      </BarChart>
    </ResponsiveContainer>
  );
}
