create table if not exists tools (
  id text primary key default gen_random_uuid()::text,
  slug text unique not null,
  title text not null,
  tagline text not null default '',
  description text not null default '',
  category text not null default 'web',
  href text not null,
  icon text not null default 'Wrench',
  badge text check (badge in ('new', 'popular', 'pro')),
  enabled boolean not null default true,
  sort_order int not null default 99,
  usage_count int not null default 0,
  updated_at timestamptz not null default now()
);
alter table tools enable row level security;
create policy "public read enabled tools" on tools for select using (enabled = true);
