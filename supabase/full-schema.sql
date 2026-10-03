-- ============================================================
-- OmniToolBox — FULL DATABASE SCHEMA (one-paste setup)
-- Paste this ENTIRE file into Supabase SQL Editor and click Run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- migrations/001_profiles.sql
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);

-- ------------------------------------------------------------
-- migrations/002_tools.sql
-- ------------------------------------------------------------
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
drop policy if exists "public read enabled tools" on tools;
create policy "public read enabled tools" on tools for select using (enabled = true);

-- ------------------------------------------------------------
-- migrations/003_blog.sql
-- ------------------------------------------------------------
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  tags text[] not null default '{}',
  reading_minutes int not null default 5,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table blog_posts enable row level security;
drop policy if exists "public read published posts" on blog_posts;
create policy "public read published posts" on blog_posts for select using (published_at is not null);

-- ------------------------------------------------------------
-- migrations/004_ai_directory.sql
-- ------------------------------------------------------------
create table if not exists ai_tools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  url text not null,
  affiliate_url text,
  category text not null default 'general',
  tags text[] not null default '{}',
  votes int not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table ai_tools enable row level security;
drop policy if exists "public read listings" on ai_tools;
create policy "public read listings" on ai_tools for select using (true);

create table if not exists ai_tool_votes (
  tool_id uuid references ai_tools(id) on delete cascade,
  viewer text not null,
  created_at timestamptz not null default now(),
  primary key (tool_id, viewer)
);
alter table ai_tool_votes enable row level security;

-- ------------------------------------------------------------
-- migrations/005_analytics.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- migrations/006_ads.sql
-- ------------------------------------------------------------
create table if not exists ad_configs (
  id uuid primary key default gen_random_uuid(),
  placement text not null,
  type text not null check (type in ('adsense', 'banner', 'affiliate')),
  slot_id text,
  image_url text,
  link_url text,
  html text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table ad_configs enable row level security;
drop policy if exists "public read enabled ads" on ad_configs;
create policy "public read enabled ads" on ad_configs for select using (enabled = true);

create table if not exists seo_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table seo_settings enable row level security;

alter table ad_configs add constraint ad_configs_placement_unique unique (placement);

-- ------------------------------------------------------------
-- Auth trigger: auto-create a profile row on every new signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Make yourself admin AFTER signing up (replace the email):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ------------------------------------------------------------
