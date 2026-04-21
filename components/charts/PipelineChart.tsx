'use client';
// ============================================================
// Business OS — PipelineChart
//
// Horizontal bar chart showing lead count per BD pipeline stage.
// Uses recharts, styled with our CSS variables so it flips cleanly
// between dark and light modes without prop changes.
//
// Data shape:
//   [
//     { stage: 'Prospect',    count: 12, color: 'var(--accent-blue)' },
//     { stage: 'Contacted',   count: 8,  color: 'var(--accent-violet)' },
//     { stage: 'Replied',     count: 5,  color: '#34C988' },
//     ...
//   ]
//
// The `color` per row is kept per-entry so the caller can match stage
// colors to the kanban (same hues across views builds intuition).
// ============================================================

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  type TooltipProps,
} from 'recharts';

export interface PipelineChartDatum {
  stage: string;
  count: number;
  /** Any valid CSS color — hex, rgb, or `var(--accent-…)`. */
  color: string;
}

export interface PipelineChartProps {
  data: PipelineChartDatum[];
  /** Chart height in px. Default: 180. */
  height?: number;
}

// Recharts tooltip payloads are loosely typed via generics — using
// `number` and `string` matches our datum (count: number, stage: string).
// The `payload.payload` field is the full datum object; we read `.stage`
// from it rather than relying on label props that get lost in the `Cell` API.
function PipelineTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const datum = item.payload as PipelineChartDatum | undefined;
  if (!datum) return null;

  return (
    <div
      style={{
        background:    'var(--bg-elevated)',
        border:        '1px solid var(--border-default)',
        borderRadius:  'var(--radius-md)',
        padding:       '8px 12px',
        boxShadow:     'var(--shadow-elevated)',
      }}
    >
      <p
        style={{
          fontSize:   11,
          fontWeight: 500,
          color:      'var(--text-primary)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {datum.stage}
      </p>
      <p
        style={{
          fontSize:   11,
          color:      'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          marginTop:  2,
        }}
      >
        {item.value} lead{item.value === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function PipelineChart({ data, height = 180 }: PipelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="stage"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
          width={100}
        />
        <Tooltip content={<PipelineTooltip />} cursor={false} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
