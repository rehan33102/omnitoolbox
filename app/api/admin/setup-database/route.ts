import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { guardApi } from "@/lib/api-security";

export const dynamic = "force-dynamic";

/**
 * One-click database setup for admin.
 * Creates all required tables if they don't exist.
 * Only accessible by admin users.
 */
const MIGRATIONS = [
  // Analytics events (dashboard live readings)
  `create table if not exists analytics_events (
    id bigint generated always as identity primary key,
    tool_slug text not null,
    action text not null default 'use',
    viewer text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists analytics_events_created_idx on analytics_events (created_at desc)`,
  `create index if not exists analytics_events_slug_idx on analytics_events (tool_slug)`,

  // User creations (what each user generates — shown in admin dashboard)
  `create table if not exists user_creations (
    id bigint generated always as identity primary key,
    user_id uuid references auth.users(id) on delete cascade,
    user_email text,
    kind text not null,
    name text not null,
    tool_slug text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists user_creations_user_idx on user_creations (user_id)`,
  `create index if not exists user_creations_created_idx on user_creations (created_at desc)`,
  `create index if not exists user_creations_kind_idx on user_creations (kind)`,

  // Profiles (admin/user roles)
  `create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    role text not null default 'user' check (role in ('admin', 'user')),
    created_at timestamptz not null default now()
  )`,

  // Tools CMS
  `create table if not exists tools_cms (
    id text primary key,
    title text not null,
    description text,
    enabled boolean default true,
    updated_at timestamptz default now()
  )`,

  // Blog posts
  `create table if not exists blog_posts (
    id text primary key,
    title text not null,
    slug text unique not null,
    content text,
    published boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )`,

  // Ads config
  `create table if not exists ads_config (
    id text primary key,
    enabled boolean default false,
    provider text,
    config jsonb,
    updated_at timestamptz default now()
  )`,

  // User library (cloud sync)
  `create table if not exists user_library (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    kind text not null,
    name text not null,
    blob_url text,
    meta jsonb,
    created_at timestamptz default now()
  )`,

  // Coarse IP geolocation columns for visit analytics (country/city only — no IPs stored)
  // + opt-in precise coordinates (only when visitor grants browser permission)
  // + identity linkage (logged-in visitors)
  `alter table analytics_events add column if not exists country text`,
  `alter table analytics_events add column if not exists city text`,
  `alter table analytics_events add column if not exists latitude double precision`,
  `alter table analytics_events add column if not exists longitude double precision`,
  `alter table analytics_events add column if not exists user_id text`,
  `alter table analytics_events add column if not exists user_email text`,
  `alter table analytics_events add column if not exists user_name text`,
  `create index if not exists analytics_events_country_idx on analytics_events (country)`,
  `create index if not exists analytics_events_user_idx on analytics_events (user_id)`,
];

export async function POST(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:setupdb", max: 10 });
  if (sec) return sec;
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // The app cannot execute DDL: there is no exec_sql RPC in production, so a
  // "one-click setup" would always fail. Be honest about it — point the admin
  // to the copy-paste SQL flow (GET ?sql=1) instead of a fake attempt.
  return NextResponse.json({
    ok: false,
    error:
      "Automatic setup is not available on this project. Copy the setup SQL from this page and run it once in Supabase Dashboard → SQL Editor.",
    sqlEndpoint: "/api/admin/setup-database?sql=1",
  });
}

export async function GET(req: NextRequest) {
  const sec = guardApi(req, { key: "admin:setupdb", max: 30 });
  if (sec) return sec;
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // ?sql=1 → return the raw setup SQL so the admin can run it in the
  // Supabase dashboard SQL editor (the app cannot execute DDL itself).
  if (req.nextUrl.searchParams.get("sql") === "1") {
    return NextResponse.json({ sql: MIGRATIONS.join(";\n\n") + ";" });
  }

  // Check which tables exist
  const supabase = createAdminClient();
  const tables = ["analytics_events", "profiles", "tools_cms", "blog_posts", "ads_config", "user_library", "seo_settings"];
  const status: Record<string, boolean> = {};

  for (const t of tables) {
    try {
      const { error } = await supabase.from(t).select("id", { head: true, count: "exact" });
      status[t] = !error;
    } catch {
      status[t] = false;
    }
  }

  return NextResponse.json({ tables: status });
}
