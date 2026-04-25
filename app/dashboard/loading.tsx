// ============================================================
// Dashboard loading skeleton — mirrors PersonalHomeClient layout
// exactly so the transition from skeleton to content has zero
// layout shift.
//
// Real layout measurements:
//   Header:       h1 32px Syne 800 + subtitle 14px → ~44px + 22px
//   Outer grid:   1fr 296px, gap 28
//   Left gap:     32 between Attention and Business Health
//   Attention:    label 11px + 2 cards (card padding 12px 16px,
//                 icon 30px + text ~40px total = 54px per card)
//   BH grid:      1fr 1fr gap 12 — MetricCard padding 16px 20px
//                 icon-row 28px, value 28px, sub 14px,
//                 divider + sub-metrics ~52px — total ≈ 138px
//   Right col:    gap 12, 3 cards (Priorities ~130px, Time Blocks
//                 ~90px, Recent Logs ~100px), each padding 16px 18px
// ============================================================
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* "Good morning" — Syne 800 32px ≈ 40px rendered height */}
        <Skeleton style={{ height: 40, width: 220 }} />
        {/* subtitle line */}
        <Skeleton style={{ height: 16, width: 280 }} />
      </div>

      {/* ── Two-column layout — matches `1fr 296px, gap: 28` ── */}
      <div className="rgrid-main-aside" style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 28, alignItems: 'start' }}>

        {/* ─── Left column ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Attention Feed section */}
          <div>
            {/* Section label "Needs Attention" */}
            <Skeleton style={{ height: 11, width: 112, marginBottom: 12 }} rounded="sm" />

            {/* 2 attention cards — card padding 12px 16px, icon 30px + text block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 1].map(i => (
                <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Severity icon circle 30×30 */}
                  <Skeleton style={{ width: 30, height: 30, flexShrink: 0, marginTop: 1 }} rounded="full" />
                  {/* Text block — title + description */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Skeleton style={{ height: 14, width: 160 }} />
                      <Skeleton style={{ height: 14, width: 56 }} rounded="full" />
                    </div>
                    <Skeleton style={{ height: 12, width: '80%' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Business Health section */}
          <div>
            {/* Section label "Business Health" */}
            <Skeleton style={{ height: 11, width: 128, marginBottom: 12 }} rounded="sm" />

            {/* 2×2 MetricCard grid — gap 12, card padding 16px 20px */}
            <div className="rgrid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="card" style={{ padding: '16px 20px' }}>
                  {/* Icon + label row — icon 28×28 + label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Skeleton style={{ width: 28, height: 28, flexShrink: 0 }} rounded="sm" />
                    <Skeleton style={{ height: 11, width: 64 }} rounded="sm" />
                  </div>
                  {/* Large metric value — Syne 800 28px */}
                  <Skeleton style={{ height: 28, width: 96, marginBottom: 6 }} />
                  {/* Sub-label e.g. "Revenue this month" */}
                  <Skeleton style={{ height: 12, width: 120 }} />
                  {/* Sub-metrics divider + 2 mini stats (on first 2 cards) */}
                  {i < 2 && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <Skeleton style={{ height: 10, width: 56 }} rounded="sm" />
                        <Skeleton style={{ height: 14, width: 48 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <Skeleton style={{ height: 10, width: 44 }} rounded="sm" />
                        <Skeleton style={{ height: 14, width: 40 }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Right column 296px — Today's Focus panel ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* "Today's Focus" label */}
          <Skeleton style={{ height: 11, width: 88 }} rounded="sm" />

          {/* Priorities card — padding 16px 18px */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <Skeleton style={{ height: 11, width: 100, marginBottom: 14 }} rounded="sm" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Checkbox circle 18×18 */}
                  <Skeleton style={{ width: 18, height: 18, flexShrink: 0 }} rounded="full" />
                  {/* Priority text */}
                  <Skeleton style={{ height: 14, flex: 1, width: `${70 - i * 10}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Time Blocks card */}
          <div className="card" style={{ padding: '16px 18px' }}>
            {/* Label + add button row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Skeleton style={{ height: 11, width: 84 }} rounded="sm" />
              <Skeleton style={{ width: 18, height: 18 }} rounded="sm" />
            </div>
            {/* 2 time block rows — left border + text + time */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[0, 1].map(i => (
                <div key={i} style={{ padding: '8px 10px', borderLeft: '3px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Skeleton style={{ height: 13, width: 96 }} />
                  <Skeleton style={{ height: 11, width: 72 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Logs card */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <Skeleton style={{ height: 11, width: 80, marginBottom: 14 }} rounded="sm" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[0, 1, 2].map((i, _, arr) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Skeleton style={{ height: 13, width: `${85 - i * 15}%` }} />
                  <Skeleton style={{ height: 10, width: 64 }} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
