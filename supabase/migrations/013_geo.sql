-- OmniToolBox: Enable location columns for visitor analytics
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (IF NOT EXISTS).
-- After running, reload /admin/analytics/visitors — location will appear.

alter table analytics_events
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists user_id text,
  add column if not exists user_email text,
  add column if not exists user_name text;

create index if not exists analytics_events_country_idx on analytics_events (country);
create index if not exists analytics_events_user_idx on analytics_events (user_id);
