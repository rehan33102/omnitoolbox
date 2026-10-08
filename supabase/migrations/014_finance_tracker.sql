-- OmniToolBox: Finance Tracker tables
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (IF NOT EXISTS / CREATE ... IF NOT EXISTS).

-- Transactions: one row per income/expense entry.
create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  viewer_id text,
  user_id text,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'PKR',
  category text not null default 'Other',
  note text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_viewer_idx on finance_transactions (viewer_id);
create index if not exists finance_transactions_user_idx on finance_transactions (user_id);
create index if not exists finance_transactions_date_idx on finance_transactions (date desc);

-- Custom categories created by visitors (defaults are baked into the app).
create table if not exists finance_categories (
  id uuid primary key default gen_random_uuid(),
  viewer_id text,
  user_id text,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now(),
  unique (viewer_id, name, type)
);

create index if not exists finance_categories_viewer_idx on finance_categories (viewer_id);
create index if not exists finance_categories_user_idx on finance_categories (user_id);

-- Per-visitor settings (currently just the display currency).
create table if not exists finance_settings (
  viewer_id text primary key,
  user_id text,
  currency text not null default 'PKR',
  updated_at timestamptz not null default now()
);

-- The app talks to these tables through the service-role key on the server,
-- so RLS is enabled with a permissive policy (defense in depth only).
alter table finance_transactions enable row level security;
alter table finance_categories enable row level security;
alter table finance_settings enable row level security;

drop policy if exists "service role full access" on finance_transactions;
create policy "service role full access" on finance_transactions
  for all using (true) with check (true);

drop policy if exists "service role full access" on finance_categories;
create policy "service role full access" on finance_categories
  for all using (true) with check (true);

drop policy if exists "service role full access" on finance_settings;
create policy "service role full access" on finance_settings
  for all using (true) with check (true);
