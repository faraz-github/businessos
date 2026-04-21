-- ============================================================
-- 021_brand_signatures.sql
--
-- Adds saved-signature support to brand_profiles so personal and
-- agency accounts can store one reusable signature (drawn or
-- uploaded stamp) per mode, avoiding the need to re-create the
-- signature every time they finalize an outgoing document.
--
-- The signature is a PICKER option in the paperwork editor's
-- SenderSignatureField — NEVER auto-applied on Send or Final.
-- The user explicitly chooses it ("Use saved") each time, or
-- can still type / draw fresh.
--
-- Columns
-- -------
--   signature_url   text   — URL of the saved signature image
--                            in brand-assets. Null if not set.
--   signature_type  text   — 'drawn' or 'uploaded'. Tracks how the
--                            signature was captured so the UI can
--                            label it correctly ("Drawn in app" vs
--                            "Uploaded stamp"). Null when no
--                            signature is saved.
--
-- Storage path shape (handled in application code):
--   brand-assets/{ownerId}/{mode}/signature-{timestamp}.{ext}
--
-- No RLS changes needed — brand_profiles already has a user_id
-- policy, and brand-assets already has the owner-scoped
-- read/write policies set in 002_rls.sql.
--
-- Rollback
-- --------
--   alter table public.brand_profiles drop column signature_url;
--   alter table public.brand_profiles drop column signature_type;
-- ============================================================

alter table public.brand_profiles
  add column signature_url  text,
  add column signature_type text
    check (signature_type in ('drawn', 'uploaded'));

-- Note: signature_type is nullable. The check constraint only fires
-- when the column has a value — a freshly-created brand_profile row
-- with no signature yet stays valid.
