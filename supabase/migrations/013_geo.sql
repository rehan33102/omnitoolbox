-- 013: coarse IP-based geolocation for visit analytics (country/city only, no IPs stored)
-- plus opt-in precise coordinates (only when the visitor explicitly grants
-- browser geolocation permission — never collected silently)
-- plus identity linkage (logged-in visitors only; anonymous = "someone").
-- Run in Supabase Dashboard → SQL Editor (the app cannot execute DDL itself).
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
