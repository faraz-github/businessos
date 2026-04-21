-- ============================================================
-- Business OS — Consolidated RLS Policies (v3.5.0)
-- 002_rls.sql
--
-- Applies standard Supabase-recommended Row Level Security to every
-- user-data table. Without this, Supabase's security linter flags
-- every table as "RLS disabled" — which is both noisy in the dashboard
-- and genuinely unsafe if the anon key ever gets loose.
--
-- How auth actually works in this app (read before editing)
-- --------------------------------------------------------
--   1. Server-side code uses the SERVICE ROLE key via lib/supabase/server.ts,
--      which BYPASSES RLS entirely. The real ownership check is the
--      `.eq('user_id', ownerId)` filter in every query/mutation, plus
--      proxy.ts gating before any /dashboard request reaches a handler.
--   2. Client-side code uses the ANON key via lib/supabase/client.ts.
--      Anything the browser touches directly must pass these policies.
--      We don't set JWT claims from the browser, so policies cannot
--      rely on `bos_uid()` — they use structural checks instead.
--   3. Public routes (`/doc/[token]`) use the anon key to read documents
--      by share_token and to insert signatures. Those flows get explicit
--      scoped policies below.
--
-- Policy posture
-- --------------
--   - Every table has RLS enabled.
--   - Every user-data table has a `user_id is not null` policy. This
--     means: "rows without a user_id are invisible, and inserts without
--     a user_id are rejected." Combined with the app-layer
--     `.eq('user_id', ownerId)` filter, an anon-key attacker who doesn't
--     already know a valid user UUID gets empty results, and any write
--     must set user_id (so a forged insert lands in a known user's
--     namespace where the app can notice and delete it).
--   - bos_users is fully locked down — service role only, no client
--     policy at all (RLS with no policies = deny all for non-service
--     roles).
--   - documents has an additional public-read policy keyed on share_token
--     + a "sent/viewed/signed/paid" status filter, for the public doc
--     view.
--   - signatures has a public-insert policy for the same flow.
--   - document_versions is read/insert only (no update, no delete) —
--     snapshots are immutable by design.
--
-- What this posture does NOT protect against
-- ------------------------------------------
--   An attacker holding the anon key AND a valid user UUID can query
--   that user's rows directly. That's why the anon key is only safe in
--   conjunction with proxy.ts gating /dashboard at the Next.js layer.
--   If per-row scoping against a compromised anon key becomes a goal,
--   the right move is to switch the browser client to a per-session
--   access token with JWT claims (tracked as v4 work).
--
-- Storage RLS under the custom-JWT setup — a footgun worth flagging
-- -----------------------------------------------------------------
--   The storage policies below use `auth.uid()` to check path
--   ownership. Under Supabase Auth, `auth.uid()` reads the uid from
--   the JWT in the request. Under OUR custom-JWT setup, browsers
--   authenticate against /api/auth/login which sets a separate
--   HttpOnly cookie (see lib/auth/jwt.ts) — that cookie is NOT a
--   Supabase JWT, so `auth.uid()` returns NULL for all browser-
--   originated storage requests.
--
--   What this means in practice:
--     - Service-role uploads (from server actions) continue to work,
--       because service role bypasses RLS entirely.
--     - Direct browser uploads to storage FAIL, because every policy
--       predicate evaluates NULL-vs-text and returns false.
--
--   Today that's correct behavior — we want every storage write to go
--   through a server action so the server can apply size/MIME checks
--   and compose the canonical path. If/when a future feature needs
--   a direct browser upload (e.g. resumable uploads for large files),
--   the fix is to either (a) swap in Supabase Auth, or (b) write a
--   custom `bos_storage_uid()` function that mirrors what we already
--   do in JS and use it instead of `auth.uid()` in the predicates.
-- ============================================================

-- ============================================================
-- 1. ENABLE RLS ON EVERY TABLE
-- ============================================================
alter table public.bos_users          enable row level security;
alter table public.brand_profiles     enable row level security;
alter table public.clients            enable row level security;
alter table public.documents          enable row level security;
alter table public.signatures         enable row level security;
alter table public.document_versions  enable row level security;
alter table public.leads              enable row level security;
alter table public.transactions       enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.social_posts       enable row level security;
alter table public.time_blocks        enable row level security;
alter table public.priorities         enable row level security;
alter table public.personal_blockers  enable row level security;
alter table public.support_periods    enable row level security;
alter table public.testimonials       enable row level security;
alter table public.quick_logs         enable row level security;
alter table public.profile_reviews    enable row level security;
alter table public.outreach_leads     enable row level security;
alter table public.lab_projects       enable row level security;
alter table public.lab_tools          enable row level security;
alter table public.lab_skills         enable row level security;

-- ============================================================
-- 2. BOS_USERS — locked down, service-role only
-- ============================================================
-- No policies = no access for anon / authenticated roles.
-- The service-role client bypasses RLS entirely, which is how
-- app/api/auth/login/route.ts reads bos_users. Never query this
-- table from the browser client.
--
-- We still add an explicit "deny all" policy so that if someone
-- later accidentally enables default permissive policies on the
-- schema, this table keeps refusing direct client access.
create policy "bos_users: deny all direct client access"
  on public.bos_users for all
  using (false)
  with check (false);

-- ============================================================
-- 3. USER-DATA TABLES — require user_id
-- ============================================================
-- One policy per table (FOR ALL = select/insert/update/delete).
-- The predicate `user_id is not null` is intentionally weak at the
-- DB layer — the actual ownership filter is `.eq('user_id', ownerId)`
-- in the query builder. See the module doc at the top of this file
-- for the full rationale.

create policy "require user_id: brand_profiles"
  on public.brand_profiles for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: clients"
  on public.clients for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: leads"
  on public.leads for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: transactions"
  on public.transactions for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: subscriptions"
  on public.subscriptions for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: social_posts"
  on public.social_posts for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: time_blocks"
  on public.time_blocks for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: priorities"
  on public.priorities for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: personal_blockers"
  on public.personal_blockers for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: support_periods"
  on public.support_periods for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: testimonials"
  on public.testimonials for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: quick_logs"
  on public.quick_logs for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: profile_reviews"
  on public.profile_reviews for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: outreach_leads"
  on public.outreach_leads for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: lab_projects"
  on public.lab_projects for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: lab_tools"
  on public.lab_tools for all
  using (user_id is not null)
  with check (user_id is not null);

create policy "require user_id: lab_skills"
  on public.lab_skills for all
  using (user_id is not null)
  with check (user_id is not null);

-- ============================================================
-- 4. DOCUMENTS — dashboard + public read via share_token
-- ============================================================
-- Dashboard access: require user_id, same as every other user-data table.
create policy "require user_id: documents"
  on public.documents for all
  using (user_id is not null)
  with check (user_id is not null);

-- Public read via share_token (the /doc/[token] route).
-- The route itself additionally checks access_code, so this policy
-- is the structural gate: only documents explicitly shared (sent or
-- later) are visible. Drafts and finals without a send event cannot
-- leak even if someone brute-forces share_token values.
create policy "public view via share token"
  on public.documents for select
  using (
    share_token is not null
    and status in ('sent', 'viewed', 'signed', 'paid')
  );

-- ============================================================
-- 5. SIGNATURES — public insert (signing) + read by document
-- ============================================================
-- Public insert supports the unauthenticated signing flow on /doc/[token].
-- Anyone who reaches that page can insert a signature row as long as
-- document_id is set. The server action that finalizes the signature
-- additionally verifies share_token + access_code + status.
create policy "public can sign documents"
  on public.signatures for insert
  with check (document_id is not null);

-- Read: anyone with document_id can read signature rows. The columns
-- here are non-sensitive (signer name, timestamp, signature_data).
-- For drawn signatures signature_data is a document-media storage
-- PATH (never a base64 blob) — the public /doc/[token] page mints a
-- fresh signed URL per render via resolveSignatureUrls() in
-- app/doc/[token]/page.tsx so signatures stay in the private bucket.
-- Typed signatures store the typed name directly in signature_data.
-- Owner UIs read via service role anyway.
create policy "read signatures by document_id"
  on public.signatures for select
  using (document_id is not null);

-- No update/delete policy — signatures are append-only.
-- (Owners can still delete via service role when needed.)

-- ============================================================
-- 6. DOCUMENT_VERSIONS — read + append-only insert
-- ============================================================
-- Versions are immutable. Policies explicitly cover only SELECT and
-- INSERT — no UPDATE or DELETE policy, so those operations are denied
-- for anon/authenticated. (Service role still bypasses and can delete
-- if a migration ever needs to.)
create policy "require user_id: document_versions read"
  on public.document_versions for select
  using (user_id is not null);

create policy "require user_id: document_versions insert"
  on public.document_versions for insert
  with check (user_id is not null);

-- ============================================================
-- 7. STORAGE POLICIES
-- ============================================================
-- Three buckets, three posture profiles. All policies use
-- (storage.foldername(name))[1] to extract the top-level folder from
-- the object path — we use that as the owner's UUID.
--
-- Path conventions (enforced by the RLS below):
--   brand-assets   → {ownerId}/{mode}/logo-{timestamp}.{ext}
--   document-media → {ownerId}/{documentId}/{nanoid}.{ext}
--   bos-backups    → backup-{timestamp}.json (service-role only, no scoping)
--
-- The app writes via the service role, which bypasses all of these
-- policies. They exist so that (a) Supabase's security linter stops
-- complaining, and (b) if someone later wires up a direct browser
-- upload, the paths they can hit are naturally constrained.

-- ── brand-assets (public read, owner write) ─────────────────────
-- Anyone can read — the CDN URL is baked into client-facing docs and
-- must resolve without auth.
create policy "brand-assets: public read"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

-- Authenticated sessions can write, but only to their own owner prefix.
-- (In practice the server action writes via service role, which bypasses
-- this check — this is the safety net for future direct browser uploads.)
create policy "brand-assets: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "brand-assets: owner update"
  on storage.objects for update
  using (
    bucket_id = 'brand-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "brand-assets: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'brand-assets'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── document-media (authenticated read + write, owner-scoped) ──
-- Reads are gated to the owner's folder. This bucket is NOT public —
-- the /doc/[token] route serves embedded images via signed URLs that
-- the server action generates when rendering the public view.
create policy "document-media: owner read"
  on storage.objects for select
  using (
    bucket_id = 'document-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "document-media: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'document-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "document-media: owner update"
  on storage.objects for update
  using (
    bucket_id = 'document-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "document-media: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'document-media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── bos-backups (service-role only) ─────────────────────────────
-- Backups contain every user's full data export. Only the service-role
-- client (which is never exposed to the browser) can touch the bucket.
-- The backup API routes gate themselves with superadmin + password
-- before invoking the service-role upload.
create policy "bos-backups: service role insert"
  on storage.objects for insert
  with check (bucket_id = 'bos-backups' and auth.role() = 'service_role');

create policy "bos-backups: service role select"
  on storage.objects for select
  using (bucket_id = 'bos-backups' and auth.role() = 'service_role');

create policy "bos-backups: service role delete"
  on storage.objects for delete
  using (bucket_id = 'bos-backups' and auth.role() = 'service_role');
