# Business OS v3.5.0 — Release Notes & Upgrade Guide

This is the consolidated handoff for v3.5.0. The codebase you have in
hand is the result of all 8 spec items applied. This document tells
you what changed, in what order to apply migrations, what to test,
and where to look if something seems off.

---

## What v3.5.0 ships

| # | Item | Status |
|---|---|---|
| 1 | Migration consolidation (3 files, fresh-deploy baseline) | Done |
| 2 | Supabase Storage everywhere (`brand-assets` + `document-media`) | Done |
| 3 | Finance system audit + Critical/Major fixes | Done |
| 4 | Invoice lifecycle: `paid_date`, backdated invoice support | Done |
| 5 | Subscription billing cycles: quarterly + semi-annual | Done |
| 6 | Paperwork: pin signature section to bottom | Done |
| 7 | Paperwork: validation audit + draft/final gating | Done (server) |
| 8 | Public doc view layout + print preview verification | Done |

Audit deliverables in `docs/`:
- `v3.5-finance-audit.md`
- `v3.5-paperwork-validation.md`
- `v3.5-public-doc-view.md`

---

## How to install / upgrade

### Fresh deploy (new Supabase project)

1. Spin up a new Supabase project in the dashboard.
2. Copy `.env.local.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET` (generate: `openssl rand -base64 32`)
   - `SEED_SECRET` (generate similarly — used for the superadmin
     seed endpoint)
3. In the Supabase dashboard SQL editor, paste and run **in this
   exact order**:
   - `supabase/migrations-consolidated/001_schema.sql`
   - `supabase/migrations-consolidated/002_rls.sql`
   - `supabase/migrations-consolidated/003_functions_and_seed.sql`
4. Install deps: `pnpm install` (note: this now includes
   `browser-image-compression`, added in step 2).
5. Start the app: `pnpm dev`.
6. Seed the superadmin: `curl -X POST http://localhost:3000/api/auth/seed -H "x-seed-secret: <YOUR_SEED_SECRET>"`
7. Log in with the credentials from your `.env.local` `SUPERADMIN_*`
   variables.

### Upgrading an existing v3.4.x instance

If you already have data in a v3.4.x Supabase project, **do not run
the consolidated migrations** — they'll error with "relation already
exists." Instead:

1. Apply ONLY the new incremental migration:
   - `supabase/migrations-incremental/020_subscription_cycles.sql`
   This widens the subscriptions check constraint to accept
   `quarterly` and `semi_annual`.
2. Manually create the new storage buckets in the Supabase dashboard
   (or run them in SQL editor):
   ```sql
   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('brand-assets', 'brand-assets', true, 2097152,
           array['image/png','image/jpeg','image/webp','image/svg+xml']);

   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   values ('document-media', 'document-media', false, 5242880,
           array['image/png','image/jpeg','image/webp']);
   ```
3. Apply the storage policies for these new buckets — copy from
   `supabase/migrations-consolidated/002_rls.sql` section 7
   (everything under "STORAGE POLICIES" for `brand-assets` and
   `document-media`). Skip the `bos-backups` policies if you already
   have them from migration 019.
4. **Migrate existing logos from `brand-logos` → `brand-assets`.**
   For each row in `brand_profiles` with a non-null `logo_url`:
   - Download the file from `brand-logos`.
   - Upload it to `brand-assets` at the new path
     `{ownerId}/{mode}/logo-{timestamp}.{ext}`.
   - Update `brand_profiles.logo_url` to the new public URL.
   - Optionally delete the old `brand-logos` file.

   You can also delete the entire `brand-logos` bucket once migrated.
   Or leave it — the v3.5 code never reads from it.
5. Update package: `pnpm install`.
6. Pull the v3.5 codebase, restart the app.

If you have NO data yet (just a v3.4 codebase, no seeded user), it's
simpler to wipe the Supabase project and do a fresh deploy from the
consolidated files.

---

## Big behavioral changes you should know about

### The home dashboard is much faster
`getHomeStats` was 8 sequential Supabase queries. Now it's a single
RPC call (`get_home_stats`). On Mumbai → Mumbai connections this is
~40 ms vs. ~320 ms. (See `docs/v3.5-finance-audit.md` Critical-1.)

### Marking an invoice paid is now a 2-step modal
Click "Mark Paid" → modal opens → pick `paid_date` (defaults today,
backdate-friendly) and category → confirm. No more one-click. The
auto-logged income transaction is dated `paid_date` and links back
to the invoice via `invoice_id`. (Step 4.)

### "Log paid invoice" button on the invoices tab
For when you got paid for work you never formally invoiced through
the system. Creates the invoice doc + transaction in one step. (Step 4.)

### Subscriptions can now be quarterly or semi-annual
Both Add and Edit modals expose all four cycles. Monthly burn auto-
normalizes via `monthlyEquivalent(cost, cycle)`. Per-month price
shown next to non-monthly entries. (Step 5.)

### Sending a doc now validates required fields
If you click Send on a paperwork doc with required fields missing,
you'll get a toast with the specific issues. The doc never gets a
share token until it's complete. (Step 7.)

### Logos go to a new bucket
`brand-assets` (replacing `brand-logos`). New logos are auto-compressed
to ≤200 KB / 512 px on upload. Public URLs change shape from
`.../brand-logos/{path}` to `.../brand-assets/{path}` — the migration
step above handles this for existing data.

### Adding sections to a paperwork doc no longer breaks the layout
"Add Section" now inserts the new section before any signature/sign-off
section, so signatures always render last. (Step 6.)

### The public doc view shows `paid_date` for paid invoices
"Paid: {date}" appears in green next to the existing "Due: {date}"
line. (Step 8.)

---

## Known gaps / what's intentionally NOT done

- **Step 7 UX**: the "Mark as Final" dual-button on the paperwork
  editor is documented in `docs/v3.5-paperwork-validation.md` but not
  implemented. The validation runs server-side; today the user
  experiences it as a toast when they click Send. Adding the dedicated
  button is a focused follow-up.
- **`document-media` bucket** — as of v3.5.1, this bucket's first UI
  consumer is drawn signatures (client + creator). See
  `docs/v3.5-signatures.md`. Additional paperwork image uploads
  (in-doc images, attachments) can reuse the same helpers.
- ~~**Dead RLS helpers in `types/database.ts`**~~ — **cleaned up in
  v3.5.1.** `bos_uid`, `bos_role`, `bos_can_access` have been removed
  from the generated types. Consolidated `002_rls.sql` didn't recreate
  them and nothing else called them.
- **`personal_blockers` and `profile_reviews` tables** exist but their
  UIs are unimplemented. Carried forward from v3.4. Not a v3.5 concern.

---

## Where the bodies are buried (debugging hints)

If something breaks, here's where to look:

### Home dashboard renders weirdly / shows wrong numbers
Check `app/dashboard/actions/home.ts` `getHomeStats`. It calls
`supabase.rpc('get_home_stats', { p_user_id, p_mode })`. The function
body is in `supabase/migrations-consolidated/003_functions_and_seed.sql`.
If the RPC isn't deployed, the function call returns null and the
dashboard renders empty. Check `select * from pg_proc where proname = 'get_home_stats';` in your Supabase SQL editor.

### Invoices show as overdue when they shouldn't
v3.5 derives "overdue" from `(due_date < today) AND (paid_date is null)
AND (status NOT IN paid/signed)` everywhere. The physical
`overdue` status column is best-effort cache. If a row has stale
`status='overdue'` but should be paid, set its status manually OR rely
on the derivation — every UI site reads correctly even if the column
is wrong. See `docs/v3.5-finance-audit.md` Critical-3 for the rationale.

### Logo upload fails with "MIME type not allowed"
The `brand-assets` bucket only accepts `image/png`, `image/jpeg`,
`image/webp`, `image/svg+xml`. Lock down by `lib/storage/constants.ts`
`ALLOWED_MIME_TYPES`. If you need to add a type, update both the
constant AND the bucket's `allowed_mime_types` array (in the SQL
editor, or via the dashboard).

### "Cannot send — required fields missing" when sending a paperwork doc
That's the new step 7 validation. The schema for each doc type is in
`types/schemas.ts` under `*RequiredSchema`. If a field is genuinely
optional, drop it from the required schema and redeploy.

### Mark Paid modal doesn't show
Check `markingPaid` state in `app/dashboard/personal/finance/page.tsx`.
It's set when clicking the row's Mark Paid button (line ~643). The
modal renders at the bottom of the page (line ~885 area).

### Backups fail / restore doesn't bring logos back
- Backups are stored in `bos-backups` bucket (private).
- Logos in backup manifests are paths into the new `brand-assets`
  bucket.
- If you're restoring a v3.4 backup (paths into `brand-logos`), the
  restore code uploads to `brand-assets` at the path the manifest
  records. So a `{ownerId}/{mode}-logo.png` path from v3.4 will
  upload as `brand-assets/{ownerId}/{mode}-logo.png` — the public URL
  changes; brand_profiles.logo_url gets refreshed during restore.

---

## File map of what changed

### New files
- `docs/v3.5-finance-audit.md`
- `docs/v3.5-paperwork-validation.md`
- `docs/v3.5-public-doc-view.md`
- `lib/storage/constants.ts`
- `lib/storage/compress.ts`
- `lib/storage/upload.ts`
- `supabase/migrations-consolidated/001_schema.sql`
- `supabase/migrations-consolidated/002_rls.sql`
- `supabase/migrations-consolidated/003_functions_and_seed.sql`
- `supabase/migrations-incremental/020_subscription_cycles.sql`
- `supabase/README.md`

### Modified files
- `package.json` — `browser-image-compression` dep
- `app/dashboard/actions/brand.ts` — canonical pattern, new bucket, removeBrandLogo
- `app/dashboard/actions/home.ts` — single-RPC stats, canonical pattern, paid_date guard
- `app/dashboard/actions/transactions.ts` — markInvoicePaid takes paid_date+category, new createPaidInvoiceAction
- `app/dashboard/actions/documents.ts` — required-field validation on final/sent transitions
- `app/dashboard/personal/finance/page.tsx` — InvoiceListRow type, mark-paid modal, log-paid modal, monthlyEquivalent
- `app/dashboard/personal/settings/page.tsx` — client-side compression, ActionResult handling, new removeBrandLogo
- `app/dashboard/personal/paperwork/page.tsx` — insertSectionBefore helper applied to 4 doc types
- `app/api/backup/create/route.ts` — bucket name swap
- `app/api/backup/restore/route.ts` — bucket name swap
- `app/api/backup/nuke/route.ts` — bucket name swap + document-media cleanup
- `app/doc/[token]/document-view.tsx` — paid_date display for invoices
- `lib/backup/index.ts` — schema version bump, document_versions in RESTORE_ORDER, LogoEntry comment
- `lib/utils/index.ts` — monthlyEquivalent helper, dead-code removed
- `types/index.ts` — BillingCycle widened
- `types/schemas.ts` — BillingCycle widened, dead invoiceSchema removed, *RequiredSchema added
- `types/database.ts` — get_home_stats + initialize_profile_reviews registered

### Renamed
- `supabase/migrations/` → `supabase/migrations-incremental/`
- `brand-logos` bucket → `brand-assets` (in code; existing data needs the migration above)

---

## Versioning

`CURRENT_SCHEMA_VERSION` in `lib/backup/index.ts` is now 20. Bump
again whenever you add a new migration that affects user-data tables.

Backup manifests written under v3.5 stamp `schema_version: 20`. They
restore cleanly into v3.5 instances. They will also restore into v3.4
instances if they don't contain `quarterly`/`semi_annual` subscriptions
or `paid_date`-bearing invoices (which is true for backups taken from
upgraded-but-untouched v3.4 data).

---

## Final checklist before shipping

- [ ] Run `pnpm install`.
- [ ] Run `pnpm typecheck`. Expect green.
- [ ] Apply migrations per the deploy path above.
- [ ] Smoke-test the home dashboard — should load fast, numbers
      should match what you see on the finance page.
- [ ] Upload a logo from settings → confirm it lands in `brand-assets`,
      not `brand-logos`.
- [ ] Create a draft invoice in paperwork → try to Send without filling
      required fields → confirm the validation toast fires.
- [ ] Mark an invoice paid via the modal with a backdated date →
      confirm the income transaction is dated correctly.
- [ ] Click "Log paid invoice" → fill it in → confirm both invoice +
      transaction land.
- [ ] Add a quarterly subscription → confirm monthly burn = cost ÷ 3.
- [ ] Open a paid invoice on `/doc/[token]` → confirm "Paid: {date}"
      shows next to "Due: {date}".

If anything in that list fails, check the corresponding doc in `docs/`
or grep the codebase for the relevant function name — the comments
explain why everything is the way it is.
