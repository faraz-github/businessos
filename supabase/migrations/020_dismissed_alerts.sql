-- migration: 020_dismissed_alerts
-- Stores permanent attention-feed dismissals per user per item.
-- Temporary dismissals are session-only (client state) and never
-- written to the DB.
--
-- Auto-resurface logic: the application re-shows a permanently
-- dismissed item if the underlying record's updated_at is newer
-- than dismissed_at — this ensures a newly overdue invoice or
-- a re-sent contract isn't silently hidden forever.

create table if not exists dismissed_alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  item_id      text not null,        -- matches AttentionItem.id e.g. "invoice-<uuid>"
  item_type    text not null,        -- matches AttentionItem.type e.g. "invoice_overdue"
  related_id   uuid not null,        -- the source record's id (for updated_at comparison)
  related_table text not null,       -- "documents" | "subscriptions" | "support_periods" | "clients" | "social_posts"
  dismissed_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- One dismissal per user per item — upsert-safe
create unique index if not exists dismissed_alerts_user_item_uidx
  on dismissed_alerts (user_id, item_id);

-- Fast lookup by user (the only query pattern we use)
create index if not exists dismissed_alerts_user_idx
  on dismissed_alerts (user_id);

-- RLS: users can only see and manage their own dismissals
alter table dismissed_alerts enable row level security;

create policy "dismissed_alerts: owner select"
  on dismissed_alerts for select
  using (user_id = bos_uid());

create policy "dismissed_alerts: owner insert"
  on dismissed_alerts for insert
  with check (user_id = bos_uid());

create policy "dismissed_alerts: owner delete"
  on dismissed_alerts for delete
  using (user_id = bos_uid());

-- ── Rollback ────────────────────────────────────────────────────
-- drop table if exists dismissed_alerts;
