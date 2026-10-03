create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  tool_slug text not null,
  action text not null default 'use',
  viewer text,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on analytics_events (created_at desc);
create index if not exists analytics_events_slug_idx on analytics_events (tool_slug);
alter table analytics_events enable row level security;
