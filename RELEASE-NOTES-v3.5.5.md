# Business OS v3.5.5 — Release Notes

**Release date:** April 2026
**Base version:** v3.5.3
**Supersedes:** v3.5.4
**Scope:** Mobile/tablet responsive work is now complete across the entire app. All dense-data rows (tables, list cards, action strips) reflow cleanly at every breakpoint without hiding any data. Includes a React hook-order bug fix.

This bundle is the **complete delta** from v3.5.3 — you can apply it directly on a v3.5.3 codebase without needing v3.5.4 first. If you already applied v3.5.4, it's safe to apply this on top (it's a superset).

---

## What's fixed

### 🐛 React Hook-order crash in `SidebarBackdrop`

`useCallback` was being called inside JSX **after** an `if (!open) return null` early return, causing the Rules of Hooks violation:

```
React has detected a change in the order of Hooks called by SidebarBackdrop.
  Previous render              Next render
  -------------------------------------------------
  1. useContext                useContext
  2. undefined                 useCallback
```

**Fix:** the `useCallback` is now called unconditionally before the early return. Eliminates the red console error and any intermittent render instability when the mobile drawer opens/closes.

**Files:** `components/dashboard/MobileNavContext.tsx`

---

## What's new in v3.5.5

### The dense-row responsive system

Every list row in the app shared the same anti-pattern: `avatar + (info flex:1, minWidth:0) + actions-with-3-to-5-inline-elements`. On mobile the actions refused to shrink, info text collapsed to `text-overflow: ellipsis`, and the layout became cramped and often unreadable (visible in the original bug-screenshot as the garbled "Austin Clark · Coegil AI", "Kristen Leaman · Indie Collaborates", etc.).

**New strategy — card metadata reflow:**

| Breakpoint | Behaviour |
|---|---|
| **Desktop (≥ 1024px)** | Unchanged from v3.5.3. Single-line flex row. |
| **Tablet (768–1023px)** | Button labels inside `.row-btn-label` collapse to icons. Primary CTAs (`.row-btn-primary`) keep their labels. |
| **Mobile (< 768px)** | CSS grid takes over with `grid-template-areas: "lead body" / "actions actions"`. Avatar stays next to the title. Meta spans automatically become chip pills and wrap. Primary CTA grows to fill the actions strip. Destructive/secondary actions (delete, preview, pause, etc.) move into a `⋯` overflow menu. Title wraps to 2 lines instead of being ellipsis-truncated. |

**No data is hidden** on any breakpoint — only destructive actions go behind `⋯`, and even then they're accessible in one tap.

### New component: `components/ui/OverflowMenu.tsx`

Accessible `⋯` dropdown used for secondary/destructive actions on mobile rows.

- Trigger is mobile-only by default (opt into `alwaysVisible` to show at all sizes)
- Handles outside-click + `Escape` close
- Positions popover below trigger, right-aligned, using `getBoundingClientRect`
- Destructive items get a red-tinted hover state
- `stopPropagation` flag for cases where the row itself is clickable (client card, lead card)

Usage:
```tsx
<OverflowMenu
  items={[
    { label: 'Preview link', icon: <ExternalLink size={14} />, onClick: () => … },
    { label: 'Delete document', icon: <Trash2 size={14} />, onClick: () => …, destructive: true },
  ]}
/>
```

Exported from `@/components/ui` barrel as both `OverflowMenu` and the `OverflowMenuItem` type.

### Pages refactored to the dense-row pattern

| File | Rows refactored |
|---|---|
| `app/dashboard/personal/social/page.tsx` | LinkedIn pipeline lead card (the screenshot bug) + content calendar post |
| `app/dashboard/personal/paperwork/page.tsx` | Document list row (highest density — 4 action buttons + conditional "Create Contract" pill) |
| `app/dashboard/personal/clients/page.tsx` | Active client row + past client row |
| `app/dashboard/personal/finance/page.tsx` | Transaction row, invoice row, subscription row |
| `app/dashboard/personal/lab/page.tsx` | Project row, tool row, skill row |
| `app/dashboard/personal/feedback/page.tsx` | Testimonial row, eligible-client row |
| `app/dashboard/personal/support/page.tsx` | Active subscription period row (with progress bar), ended period row |
| `app/dashboard/agency/social/page.tsx` | Content calendar post row |
| `app/dashboard/loading.tsx` | Skeleton now uses `rgrid-main-aside` + `rgrid-2` so the loading state matches the real layout at all breakpoints (no layout shift on resolve) |

### CSS additions (in `app/globals.css`)

~180 lines appended at the end, namespaced `dense-row-*`. Key classes:

- `.dense-row`, `.dense-row__lead`, `.dense-row__body`, `.dense-row__title`, `.dense-row__name`, `.dense-row__meta`, `.dense-row__meta-sep`, `.dense-row__actions`, `.dense-row__lead-body` (safety-net pass-through for legacy markup)
- `.row-btn-primary` — marks the primary CTA that should keep its label at every breakpoint and grow full-width on mobile
- `.row-btn-label` — wrap button text in this span so it collapses to icon on tablet/mobile
- `.row-btn-keep-label` — opt-out: keep this button's label visible on mobile even if not primary
- `.chip` / `.chip-opt-out` — reusable pill styling + marker that prevents the mobile auto-chipify pass from touching that element
- `.hide-on-mobile-row` — used for desktop-only action buttons when the same action is also in the overflow menu
- `.overflow-menu-trigger.mobile-only` + `.overflow-menu-popover` + `.overflow-menu-item` + `--danger` variant

### Everything previously in v3.5.4

This bundle includes the full v3.5.4 responsive foundation:

- Viewport meta + `themeColor` in `app/layout.tsx`
- `.page-pad`, `.rgrid-*`, `.filter-bar`, `.scroll-x`, `.touch-target`, `.show-mobile/hide-mobile/show-tablet/hide-tablet` utilities
- `MobileNavContext` + `SidebarBackdrop` + drawer sidebar
- Mobile hamburger + full-screen mobile search in `TopBar`
- `.ds-modal-wrap` + `.ds-modal` safe-area modals
- `.ds-toast-container` safe-area toasts
- Responsive public doc view at `/doc/[token]` (820px breakpoint, fluidizes A4 sheet)

See comments in `app/globals.css` for the full utility reference.

---

## Files changed

**Total:** 26 files (2 new, 24 modified)

### New files
- `components/dashboard/MobileNavContext.tsx` (v3.5.4)
- `components/ui/OverflowMenu.tsx` (v3.5.5)

### Modified files

**CSS / layout shell:**
- `app/globals.css` — v3.5.4 responsive utilities + v3.5.5 dense-row system
- `app/layout.tsx` — viewport export
- `app/dashboard/layout.tsx` — `MobileNavProvider` + `SidebarBackdrop` wrappers
- `app/dashboard/loading.tsx` — skeleton rgrid classes
- `components/dashboard/Sidebar.tsx` — drawer behaviour
- `components/dashboard/TopBar.tsx` — hamburger + mobile search sheet
- `components/dashboard/QuickLogModal.tsx` — mobile safe-area
- `components/ui/Modal.tsx` — mobile safe-area
- `components/ui/Toast.tsx` — mobile safe-area
- `components/ui/index.ts` — `OverflowMenu` export

**Pages with dense-row refactors (+ all v3.5.4 grid responsiveness):**
- `app/dashboard/personal/social/page.tsx`
- `app/dashboard/personal/paperwork/page.tsx`
- `app/dashboard/personal/clients/page.tsx`
- `app/dashboard/personal/finance/page.tsx`
- `app/dashboard/personal/lab/page.tsx`
- `app/dashboard/personal/feedback/page.tsx`
- `app/dashboard/personal/support/page.tsx`
- `app/dashboard/agency/social/page.tsx`

**Pages with v3.5.4 grid-only responsiveness:**
- `app/dashboard/personal/home/client.tsx`
- `app/dashboard/personal/settings/page.tsx`
- `app/dashboard/personal/compose/page.tsx`
- `app/dashboard/agency/home/client.tsx`
- `app/dashboard/agency/bd-pipeline/page.tsx`
- `app/doc/[token]/document-view.tsx`

---

## Design decisions worth knowing

**Why horizontal scroll for wide tables instead of reflow-to-cards?**
Some tables (invoice line items in `paperwork`, BD pipeline tables) have a fixed-column structure where every field is comparable at a glance. Reflowing them to stacked cards on mobile breaks that scanning affordance. Horizontal scroll inside a `.scroll-x` wrapper preserves the table semantics while keeping page overflow controlled.

**Why keep form-pair grids side-by-side on mobile inside `size="sm"` modals?**
A mobile modal is usually ~320px wide, minus 40px side padding = 280px. Two 50% columns is 130px per field — plenty for date/number/currency inputs, which is what every form-pair in this app renders. Stacking them creates 2× taller scrolling forms that users have to scroll through on a small screen. The current tight-but-works layout is better.

**Why does the primary CTA grow full-width on mobile but not secondary actions?**
Fitts's law. The primary CTA (Send, Mark Paid, Activate, Request, Closing Message) is what the user came to the row for. A ≥40px-tall full-width button is the easiest tap target on mobile. Secondary actions (Edit, icon-only nav) are 40×40 squares — still comfortably tappable but visually secondary.

**Why `⋯` overflow menu instead of a wrapped row of all buttons?**
At 320px wide, even 4 × 40px buttons (160px) plus a 40px-tall full-width primary CTA means the row is already ~100px tall. Adding two more destructive buttons to the wrap pushes it to ~150px — three full-height rows per entry on a scrolling list. Moving them behind `⋯` keeps each row to one primary action + one overflow affordance, which scans much better.

---

## Applying this bundle

If starting from a clean v3.5.3 codebase:

1. Extract this zip over the project root. All 26 files will land in the correct paths.
2. No new dependencies required. The CSS, the `OverflowMenu` component, and the refactored pages use only things already in v3.5.3's stack.
3. Restart the dev server (`npm run dev` / `bun dev`).

If you already applied v3.5.4:

1. Extract this zip over your working tree. It's safe — the v3.5.4 files in the bundle are byte-identical to what you already have (except `app/globals.css`, which has the new dense-row system appended).
2. The new files are `components/ui/OverflowMenu.tsx` and the v3.5.4 `MobileNavContext.tsx`.

---

## Next up: v3.5.6 PWA phase

The responsive foundation is now complete. The PWA phase (install prompt, service worker, offline fallback, manifest, push notifications) is separately planned and does not affect any of the code in this bundle.
