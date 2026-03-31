'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface PipelineChartProps {
  data: { stage: string; count: number; color: string }[];
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] px-3 py-2 shadow-[var(--shadow-elevated)]">
      <p className="text-[11px] font-medium text-[var(--text-primary)]">{payload[0].payload.stage}</p>
      <p className="text-[11px] text-[var(--text-secondary)]">{payload[0].value} leads</p>
    </div>
  );
}

export function PipelineChart({ data, height = 180 }: PipelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="stage"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          width={100}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
