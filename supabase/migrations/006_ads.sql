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
create policy "public read enabled ads" on ad_configs for select using (enabled = true);

create table if not exists seo_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table seo_settings enable row level security;

alter table ad_configs add constraint ad_configs_placement_unique unique (placement);
