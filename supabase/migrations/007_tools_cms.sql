-- CMS columns for the tools table: card image, SEO keywords, soft-delete flag.
-- Run in Supabase SQL editor if not applied. The admin API degrades gracefully
-- when these columns are missing (image/keywords/delete fall back safely).
alter table tools add column if not exists image text not null default '';
alter table tools add column if not exists keywords text[] not null default '{}';
alter table tools add column if not exists is_deleted boolean not null default false;
