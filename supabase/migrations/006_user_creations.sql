-- Track what users create so admin dashboard can show per-user activity
create table if not exists user_creations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  kind text not null, -- 'voiceover' | 'image' | 'qr' | 'pdf' | 'video'
  name text not null,
  tool_slug text,
  created_at timestamptz not null default now()
);
create index if not exists user_creations_user_idx on user_creations (user_id);
create index if not exists user_creations_created_idx on user_creations (created_at desc);
create index if not exists user_creations_kind_idx on user_creations (kind);
alter table user_creations enable row level security;
