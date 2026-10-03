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
create policy "public read published posts" on blog_posts for select using (published_at is not null);
