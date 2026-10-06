"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Megaphone, Search, Users, Wrench } from "lucide-react";
import { Input } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Global admin search. Debounced (300ms). Searches tools, blog posts, users
 * and ad placements across whichever endpoints exist — each source degrades
 * gracefully on its own. Results link to the right admin pages.
 * NOT mounted anywhere — the parent mounts this in the admin header.
 */
interface Result {
  key: string;
  kind: "tool" | "blog" | "user" | "ad";
  title: string;
  subtitle?: string;
  href: string;
}

const KIND_ICON = {
  tool: Wrench,
  blog: FileText,
  user: Users,
  ad: Megaphone,
} as const;

async function safeJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function searchAll(q: string): Promise<Result[]> {
  const needle = q.toLowerCase();
  const [toolsJ, blogJ, usersJ, adsJ] = await Promise.all([
    safeJson("/api/tools"),
    safeJson("/api/admin/blog"),
    safeJson(`/api/admin/users?search=${encodeURIComponent(q)}`),
    safeJson("/api/admin/ads"),
  ]);

  const results: Result[] = [];

  const tools = (toolsJ as { tools?: { slug: string; title: string; href?: string }[] } | null)?.tools ?? [];
  for (const t of tools) {
    if (t.title?.toLowerCase().includes(needle) || t.slug?.toLowerCase().includes(needle)) {
      results.push({ key: `tool-${t.slug}`, kind: "tool", title: t.title, subtitle: t.slug, href: t.href ?? `/tools/${t.slug}` });
    }
  }

  const posts = (blogJ as { posts?: { slug: string; title: string }[] } | null)?.posts ?? [];
  for (const p of posts) {
    if (p.title?.toLowerCase().includes(needle) || p.slug?.toLowerCase().includes(needle)) {
      results.push({ key: `blog-${p.slug}`, kind: "blog", title: p.title, subtitle: `/blog/${p.slug}`, href: "/admin/blog" });
    }
  }

  const users = (usersJ as { users?: { id: string; email: string; fullName?: string }[] } | null)?.users ?? [];
  for (const u of users.slice(0, 10)) {
    results.push({ key: `user-${u.id}`, kind: "user", title: u.email, subtitle: u.fullName || undefined, href: "/admin/users" });
  }

  const ads = (adsJ as { ads?: { id: string; placement: string; type: string }[] } | null)?.ads ?? [];
  for (const a of ads) {
    if (String(a.placement ?? "").toLowerCase().includes(needle) || String(a.type ?? "").toLowerCase().includes(needle)) {
      results.push({ key: `ad-${a.id}`, kind: "ad", title: `Ad: ${a.placement}`, subtitle: String(a.type), href: "/admin/monetization" });
    }
  }

  return results.slice(0, 20);
}

export default function AdminSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const rs = await searchAll(query);
        setResults(rs);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
        <Input
          placeholder="Search tools, posts, users, ads…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute top-full mt-2 left-0 right-0 z-50 glass-strong rounded-xl shadow-glass max-h-[60vh] overflow-y-auto">
          {searching ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500 text-center">No matches for “{q.trim()}”.</p>
          ) : (
            <ul className="py-2">
              {results.map((r) => {
                const Icon = KIND_ICON[r.kind];
                return (
                  <li key={r.key}>
                    <Link
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <Icon className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{r.title}</span>
                        {r.subtitle && <span className="block text-xs text-zinc-500 truncate">{r.subtitle}</span>}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-zinc-400 shrink-0">{r.kind}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
