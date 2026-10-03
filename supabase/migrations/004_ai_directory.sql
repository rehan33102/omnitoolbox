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
create policy "public read listings" on ai_tools for select using (true);

create table if not exists ai_tool_votes (
  tool_id uuid references ai_tools(id) on delete cascade,
  viewer text not null,
  created_at timestamptz not null default now(),
  primary key (tool_id, viewer)
);
alter table ai_tool_votes enable row level security;
