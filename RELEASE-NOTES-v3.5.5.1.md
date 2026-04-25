# Business OS v3.5.5.1 — Patch Release Notes

**Release date:** April 2026
**Base version:** v3.5.3
**Supersedes:** v3.5.5
**Scope:** Five mobile responsiveness fixes uncovered after v3.5.5 was deployed. Drop-in replacement — no code-level changes required if you've already applied v3.5.5.

This bundle is the **complete delta from v3.5.3** (full superset of v3.5.4, v3.5.5, and these new fixes). Apply it directly without needing prior bundles.

---

## Issues fixed in this patch

### 1. Modal padding too generous on small phones

The modal card was taking 24px horizontal padding inside, plus 8px outside, leaving cramped content area on narrow screens (e.g. the lead-edit dialog with its long requirement text).

**Fix:** Below 480px, internal padding is now 16px sides (down from 24px), 16px top, 12px after header, 18px at body bottom. Saves ~16px of horizontal room — about 10% of the visible width on a 360px phone — without the modal feeling cramped.

**Files:** `components/ui/Modal.tsx` (added `ds-modal__header` and `ds-modal__body` marker classes), `app/globals.css` (mobile padding overrides).

### 2. Paperwork tab strip wrapped + couldn't scroll

The "All / Proposal / Contract / Scope of Work / Requirements / Invoice / NDA" filter strip wrapped onto multiple lines on mobile. "Scope of Work" was breaking into "Scope of\nWork" mid-row, looking broken. Same problem on Settings ("Team & Access" → "Team &\nAccess"), Finance, Lab, Clients, BD pipeline, and Social tab strips.

**Fix:** New `.tabs-scroll` utility class — applies `overflow-x: auto`, `white-space: nowrap`, and `scroll-snap` to a tab container. Each tab keeps its natural width and the strip becomes swipeable on touch. Scrollbar visually hidden but accessible to keyboard navigation.

**Applied to:** Paperwork (Type filter), Settings (Brand/Team/Backup), Lab, Finance, Clients (section tabs), Social (Pipeline/Calendar), BD Pipeline.

This is a **per-component opt-in**, not a global change — content-level horizontal scrolling is only used where the design genuinely shows more tabs than fit. Other narrow layouts continue to use stacked or icon-collapse strategies.

### 3. Finance "Recent Transactions" / "Upcoming Renewals" cards overflowed the screen

Mobile rendering of the Finance home tab pushed the two summary cards past the viewport's right edge. Looking at iPhone 14 Pro Max screenshots, the right edge of both cards (and their content) was clipped by the screen.

**Root cause:** `.rgrid-2` (and other rgrid utilities) used `grid-template-columns: 1fr` at mobile, which CSS resolves as `minmax(auto, 1fr)`. The `auto` minimum is the **min-content size** — meaning if any child has unbreakable content wider than the viewport (a long subscription name without ellipsis), the column expands to fit it, overflowing the viewport.

**Fix:** All mobile `.rgrid-*` rules now use `grid-template-columns: minmax(0, 1fr)`. Affects `.rgrid-2`, `.rgrid-3`, `.rgrid-4`, `.rgrid-main-aside`, `.rgrid-aside-main`. Also added missing ellipsis to the subscription name in the Upcoming Renewals row.

**Files:** `app/globals.css`, `app/dashboard/personal/finance/page.tsx`.

### 4. Testimonial action icons not centered in their tap-target buttons

The Copy/Edit/⋯ icon buttons on the testimonial row had inline `display: flex; padding: 5px` but didn't set `align-items / justify-content: center`. At desktop the buttons were 22×22 (`padding: 5px` around a 12px icon) so the icon naturally centered. But on mobile, the dense-row mobile rule forced `min-width: 40px; min-height: 40px` for tap-target compliance — the icon stayed in the top-left corner of the now-larger button.

**Fix:** Added `align-items: center !important; justify-content: center !important` to the dense-row mobile button rule globally — catches every dense-row icon button across the app without per-page edits. Also fixes the same issue on every other dense-row page (lab, clients, finance, etc.) that I'd missed.

**Files:** `app/globals.css`.

### 5. Settings "Saved / Draw / Upload" tabs overflowed the screen

In the brand-settings signature panel, the layout was a flex row: 160px preview + 20px gap + flex:1 controls. On a 430px-wide phone with 16px page padding and ~24px card padding, the controls column got only ~158px while the three signature-mode tabs needed ~240px. Tabs and the description+Remove row both got clipped.

**Fix:** New `.signature-row` class. Below 480px it switches `flex-direction: column` so the preview sits on top and controls take full width below. No squeezing.

**Files:** `app/globals.css`, `app/dashboard/personal/settings/page.tsx`.

---

## CSS additions (in `app/globals.css`)

About 50 new lines, namespaced as a `PATCH v3.5.5.1` block at the end of the file:

- `.tabs-scroll` — horizontally scrolling tab strip with `nowrap` children
- Mobile rgrid sweep — every mobile `1fr` becomes `minmax(0, 1fr)`
- `.dense-row__actions` mobile centering — applies to every existing dense-row button automatically
- `.signature-row` — preview-on-top stacking on small phones
- `.ds-modal__header` and `.ds-modal__body` — narrower padding on small phones

The Modal component (`components/ui/Modal.tsx`) gains two marker classes (`ds-modal__header`, `ds-modal__body`) so the CSS can override its inline padding at mobile breakpoint without touching any consumer of the Modal.

---

## Files changed (vs v3.5.3)

**Total:** 26 files (2 new, 24 modified) — same set as v3.5.5 plus the patch edits to Modal, globals.css, and 7 pages getting `tabs-scroll`.

### New files (unchanged from v3.5.5)
- `components/dashboard/MobileNavContext.tsx`
- `components/ui/OverflowMenu.tsx`

### Files newly touched in v3.5.5.1 (on top of v3.5.5)
- `app/globals.css` — patch block appended (modal padding, rgrid sweep, tabs-scroll, dense-row centering, signature-row)
- `components/ui/Modal.tsx` — added `ds-modal__header` + `ds-modal__body` marker classes
- `app/dashboard/personal/paperwork/page.tsx` — type-filter strip uses `tabs-scroll`
- `app/dashboard/personal/settings/page.tsx` — Brand/Team/Backup tab strip uses `tabs-scroll`; signature row uses `.signature-row`
- `app/dashboard/personal/finance/page.tsx` — main tab strip uses `tabs-scroll`; Upcoming Renewals row gets ellipsis on subscription name
- `app/dashboard/personal/lab/page.tsx` — tab strip uses `tabs-scroll`
- `app/dashboard/personal/clients/page.tsx` — section tab strip uses `tabs-scroll`
- `app/dashboard/personal/social/page.tsx` — Pipeline/Calendar tabs use `tabs-scroll`
- `app/dashboard/agency/bd-pipeline/page.tsx` — tab strip uses `tabs-scroll`

### Other files (carried from v3.5.4 / v3.5.5, unchanged this patch)
All other v3.5.4 + v3.5.5 files are present and identical.

---

## Applying this bundle

If you've already deployed v3.5.5, applying v3.5.5.1 is safe:
1. Extract the zip over your project root.
2. The 13 v3.5.4 files in this bundle are byte-identical to what you have.
3. The 11 v3.5.5 files include the same dense-row refactors plus the patches above.
4. The 2 new files (`OverflowMenu.tsx`, `MobileNavContext.tsx`) are byte-identical to v3.5.5.

If you're starting from a fresh v3.5.3 codebase: extract this zip and you have everything.

No new dependencies. No config changes.

---

## Verification

After applying, on a 430px-wide mobile viewport:

1. **Modal padding**: Open any "Edit Lead" / "New Document" modal — internal padding should feel tighter (~16px sides) than before.
2. **Paperwork tabs**: Open `/dashboard/personal/paperwork`. The "All / Proposal / Contract / Scope of Work / Requirements / Invoice / NDA" strip should scroll horizontally with a swipe; "Scope of Work" should stay on one line.
3. **Finance home**: Open `/dashboard/personal/finance`. The "Recent Transactions" and "Upcoming Renewals" cards should fit within the viewport. Long subscription names should ellipsis-truncate.
4. **Testimonial buttons**: Open `/dashboard/personal/feedback`. The Copy / Edit / ⋯ icons on each testimonial card should sit centered inside their 40×40 tap-target buttons.
5. **Settings signature**: Open `/dashboard/personal/settings`, scroll to Signature. The preview should sit on top, with Saved / Draw / Upload tabs below it (full-width). The "Brand Settings / Team & Access / Backup & Restore" tab strip at the top should scroll horizontally without wrapping.

---

## Next: v3.5.6 PWA phase

This patch closes out the responsive work. The PWA phase remains as planned and is unaffected by these changes.
