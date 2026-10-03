create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = id);
