# Business OS — v3.5.4 Release Notes

**Release**: v3.5.4 — Responsive Design Pass
**Type**: Patch release (no feature additions, no API/schema changes)
**Depends on**: v3.5.3 (drop these files in over a v3.5.3 working copy)

---

## TL;DR

v3.5.4 makes Business OS fully responsive across mobile (360px+), tablet (768px+), and desktop (1024px+) viewports. **Zero desktop regressions** — the approach is purely additive (parallel `className` hooks with media queries layered on top of the existing inline styles).

**23 files changed** · **1 new file** (`MobileNavContext.tsx`) · **No package.json dependency changes** · **No new env vars, migrations, or config**.

---

## What Changed

### 1. Foundation (`app/globals.css`, `app/layout.tsx`)

- **Viewport meta now declared** via Next.js `viewport` export. Previously missing entirely — critical for all responsive work and required for the upcoming PWA phase. Includes `themeColor` for both schemes and `viewportFit: 'cover'` for iOS safe-area support.
- **Responsive utility system appended to `globals.css`** (~250 lines, all mobile-first media queries). Introduces the following classes — all are purely additive and never touch desktop styling:
  - **Visibility**: `.show-mobile`, `.hide-mobile`, `.show-tablet`, `.hide-tablet`, `.mobile-only-hamburger`
  - **Page container**: `.page-pad` — 40px desktop, 24px tablet, 16px mobile horizontal padding with `env(safe-area-inset-bottom)` handling
  - **Responsive grids** (override inline `gridTemplateColumns` via `!important` at narrow widths): `.rgrid-4`, `.rgrid-3`, `.rgrid-2`, `.rgrid-4-compact`, `.rgrid-main-aside`, `.rgrid-aside-main`, `.rgrid-form-row`, `.rgrid-keep`
  - **Layout**: `.scroll-x` (horizontal-scroll wrapper for wide tables), `.filter-bar` (flex-wrap row for toolbars), `.touch-target` (≥40px hit area on mobile)
  - **Component hooks**: `.ds-modal-wrap`, `.ds-modal`, `.ds-toast-container`, `.ds-sidebar-responsive`, `.sidebar-drawer`, `.sidebar-backdrop`, `.ds-topbar-mobile`
- **iOS zoom-on-focus prevention** — inputs, selects, and textareas force to 16px font on mobile via a scoped media query.
- **Overflow protection** — `html, body { overflow-x: hidden }` below 768px prevents sideways page scroll from any stray wide element.

### 2. Mobile Navigation Shell (NEW)

- **`components/dashboard/MobileNavContext.tsx`** (new file) — provides `MobileNavProvider`, `useMobileNav()`, and `SidebarBackdrop`. Owns the drawer open/close state, auto-closes on route change, locks body scroll while open, closes on Escape. Safe to call outside the provider (returns no-ops).
- **`app/dashboard/layout.tsx`** — wrapped with `<MobileNavProvider>`, renders `<SidebarBackdrop />`, replaced hard-coded `padding: '28px 40px 48px'` with `className="page-pad"`.
- **`components/dashboard/Sidebar.tsx`** — now toggles between sticky column (≥1024px) and slide-in drawer (<1024px) via CSS class `ds-sidebar-responsive` + `is-open`. Adds a close button in the brand row visible only when the drawer is active.
- **`components/dashboard/TopBar.tsx`** — significant additions:
  - New hamburger button at the left, visible below 1024px (`mobile-only-hamburger`)
  - Date text hidden on mobile (`hide-mobile`)
  - Desktop inline search input hidden below 768px, replaced by a search **icon button** that opens a **full-screen search sheet** with a larger 14px input, Cancel button, and friendlier 32×32 result icons
  - Mobile search sheet autofocuses, locks body scroll, and closes on result-click / Cancel / Escape
  - Quick Log button label wrapped so it collapses to a Zap icon below 768px
  - Icon buttons all get `touch-target` class for ≥40px hit areas
  - Header gets `ds-topbar-mobile` class to tighten horizontal padding to 16px below 768px

### 3. Modal / Toast Safe-Area Handling

- **`components/ui/Modal.tsx`** — added `ds-modal-wrap` + `ds-modal` classes so the mobile CSS applies `max-height: 100dvh - 16px`, `max-width: 100vw - 16px`, top-aligned positioning with `env(safe-area-inset-top)` padding, and `touch-target` on the close button. Title container gets `minWidth: 0, flex: 1` so long titles don't overflow.
- **`components/ui/Toast.tsx`** — added `ds-toast-container` class. On mobile, toasts stretch full-width with 12px side gutters and sit at `bottom: calc(16px + env(safe-area-inset-bottom))` so they clear the Android home-gesture bar and will clear the iOS home-indicator when the app runs as an installed PWA.
- **`components/dashboard/QuickLogModal.tsx`** — same `ds-modal-wrap` + `ds-modal` class pair for consistent mobile treatment.

### 4. Page-Level Grid Responsiveness

Systematic application of `.rgrid-*` classes to inline `gridTemplateColumns` styles across all major pages. Grids inside narrow `size="sm"` modals (Finance add-transaction, subscription modals, time-block time inputs) were **intentionally left side-by-side** — at mobile modal widths (~344px) they render at ~160px per field, which is usable for dates/numbers/short text, and stacking would create tall scrolling forms.

**Pages touched** (all grid occurrences handled unless marked intentional-keep):

| Page | Top-level grids | Notable changes |
|---|---|---|
| `personal/home/client.tsx` | 2 | Main layout (`rgrid-main-aside`), Business Health (`rgrid-2`), time-block picker (`rgrid-4-compact`) |
| `agency/home/client.tsx` | 4 | BD Activity, main layout, Business Health, time-block picker |
| `personal/finance/page.tsx` | 3 | Summary 4-card row (`rgrid-4`), Outstanding/Collected/Subs stats (`rgrid-3`), Transactions+Renewals (`rgrid-2`). Filter bars tagged with `filter-bar` |
| `personal/paperwork/page.tsx` | 20+ | xl-modal meta row, invoice detail pairs, contract/SOW/requirements parties and project dates, signatures, doc-type pickers. **Invoice line-items wrapped in horizontal-scroll container with `min-width: 520px`.** Two payment-schedule `1fr auto auto` rows marked with `rgrid-form-row` |
| `personal/settings/page.tsx` | 5 | Identity/Brand/Payment form grids collapsed |
| `agency/bd-pipeline/page.tsx` | 1 + 2 tables | Summary 3-card stats (`rgrid-3`), toolbar (`filter-bar`). **Contacts and Deals tables wrapped in horizontal-scroll containers with `min-width: 720px`.** Kanban view already had `overflowX: auto` |
| `personal/clients/page.tsx` | 8 | Contact-info grids, client-detail form pairs |
| `personal/lab/page.tsx` | 7 | Metrics row, experiment pairs |
| `personal/social/page.tsx` | 4 | 4-col stats, main-aside (`1fr 280px`), form pairs |
| `personal/support/page.tsx` | 1 | Form pair |
| `personal/feedback/page.tsx` | 2 | Stats row, form pair |
| `personal/compose/page.tsx` | 2 | Aside-main sidebar (`240px 1fr` → `rgrid-aside-main`), conditional link grid |
| `agency/social/page.tsx` | 3 | Stats row, main-aside, form pair |

### 5. Public Document View (`/doc/[token]`)

The highest-visibility external page — what your clients see on their phones when viewing proposals, contracts, and invoices. Previously rendered at a **fixed 794px width** (A4 at 96dpi), overflowing any viewport below ~826px.

**`app/doc/[token]/document-view.tsx`** changes:
- New `@media screen and (max-width: 820px)` block appended to the existing inline `<style>`. Fluidizes the A4 sheet (`width: 100%`) and reduces the 56px inline gutters to 22px (16px below 380px).
- **Print behavior is completely untouched** — the `screen and` qualifier scopes the new rules to screen media only. Existing `@media print` rules still use `!important` throughout and continue to render pixel-perfect A4 PDFs.
- Element-level stacking rules activated via new class names on existing elements:
  - `doc-sign-cta` — Sign CTA stacks vertically with full-width button on mobile
  - `doc-parties-grid` — 2-col parties collapses to 1-col
  - `doc-invoice-header` — "Invoice To" / "Invoice #" stacks vertically
  - `doc-invoice-table-wrap` — line items wrap in a horizontal-scroll container with `min-width: 480px`
  - `doc-invoice-totals` — 220px min-width relaxes to 100%
  - Signatures flex row stacks vertically on mobile
  - Title shrinks 26px → 22px
  - Hero header wraps cleanly when space is tight

---

## Design Decisions Worth Flagging

**Approach: Option A (additive classes, not inline-style refactor).** The existing codebase uses inline `style={{}}` throughout rather than utility classes. Rather than refactor that pattern, v3.5.4 adds parallel `className` hooks whose CSS uses `!important` at narrow breakpoints to override the inline `gridTemplateColumns`. This keeps diffs minimal, isolates risk to the CSS layer, and preserves desktop rendering exactly. A future cleanup pass could gradually migrate to utility classes — v3.5.4 doesn't require it.

**Grids intentionally kept side-by-side on mobile:**
- Sub-metric pairs inside MetricCards (Outstanding/Overdue, Pipeline/All-time) — short labels + short values, already readable at any width
- Time-input pairs (Start Time / End Time) — time pickers read better paired
- Form-field pairs inside `size="sm"` modals — at 360px modal width these become ~160px per field, which is fine for dates, numbers, and short text. Stacking them would produce tall scrolling forms on phones.

**Horizontal scroll for data tables rather than re-flow.** BD Pipeline tables and paperwork invoice line-items use fixed-column grid templates that cannot sensibly collapse (trying to reflow a 7-column lead table into stacked cards is almost never a UX improvement on tablets). Instead, each table lives in a horizontal-scroll container with a sensible `min-width`. Users scroll horizontally within the card rather than the page scrolling sideways.

---

## How to Apply

These 23 files drop in over a v3.5.3 working copy. No package.json changes, no schema changes, no new env vars. After copying:

```bash
pnpm typecheck   # should pass
pnpm build       # should succeed
pnpm dev         # verify at 360 / 768 / 1280 widths
```

Open DevTools → Responsive panel. Test:
- Sidebar drawer opens/closes from hamburger + backdrop + route change
- Modals fit within the viewport with safe-area respected
- BD Pipeline table scrolls horizontally inside the card at 360px
- Paperwork invoice line-items scroll horizontally inside the card
- Public `/doc/[token]` renders without page horizontal scroll on a phone
- Print preview of a signed document still renders pixel-perfect A4

---

## Files Changed (23 total)

### Modified (22)

```
app/globals.css
app/layout.tsx
app/dashboard/layout.tsx
app/dashboard/agency/bd-pipeline/page.tsx
app/dashboard/agency/home/client.tsx
app/dashboard/agency/social/page.tsx
app/dashboard/personal/clients/page.tsx
app/dashboard/personal/compose/page.tsx
app/dashboard/personal/feedback/page.tsx
app/dashboard/personal/finance/page.tsx
app/dashboard/personal/home/client.tsx
app/dashboard/personal/lab/page.tsx
app/dashboard/personal/paperwork/page.tsx
app/dashboard/personal/settings/page.tsx
app/dashboard/personal/social/page.tsx
app/dashboard/personal/support/page.tsx
app/doc/[token]/document-view.tsx
components/dashboard/QuickLogModal.tsx
components/dashboard/Sidebar.tsx
components/dashboard/TopBar.tsx
components/ui/Modal.tsx
components/ui/Toast.tsx
```

### New (1)

```
components/dashboard/MobileNavContext.tsx
```

---

## What's Next (v3.5.5 — PWA)

v3.5.4 sets up the groundwork for the upcoming PWA work:

- Viewport meta with `themeColor` already declared ✓
- `env(safe-area-inset-*)` already used in page-pad, modals, toasts ✓
- Bottom-navigation room already reserved in mobile `page-pad` ✓

v3.5.5 will add: `public/` folder with manifest + icons, Serwist service worker with auth-aware caching strategy, offline fallback page, and install-prompt UX. Push notifications can layer on top later once the install baseline ships.

---

*End of v3.5.4 notes.*
