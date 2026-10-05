import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";

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
];

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const results: { migration: string; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i];
    try {
      // Use rpc to execute raw SQL (requires a helper function, fallback to direct)
      const { error } = await supabase.rpc("exec_sql", { sql });
      if (error) {
        // If exec_sql doesn't exist, try via from() as a connectivity check
        // and report that manual SQL is needed
        results.push({
          migration: `migration_${i + 1}`,
          ok: false,
          error: "exec_sql RPC not available. Please run SQL manually in Supabase dashboard.",
        });
      } else {
        results.push({ migration: `migration_${i + 1}`, ok: true });
      }
    } catch (e) {
      results.push({
        migration: `migration_${i + 1}`,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  // Check which tables exist
  const supabase = createAdminClient();
  const tables = ["analytics_events", "profiles", "tools_cms", "blog_posts", "ads_config", "user_library"];
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
