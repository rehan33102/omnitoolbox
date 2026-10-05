"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Nike-style profile icon in header.
 * Not logged in → dropdown with "Join Us" (signup) + "Sign In" (login).
 * Logged in → avatar initial + menu (Dashboard, Logout).
 */
export default function ProfileMenu() {
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
    window.location.href = "/";
  };

  const initial = (user?.user_metadata?.full_name || user?.email || "?").charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="p-2.5 rounded-xl glass">
        <User size={18} className="opacity-40" />
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Account"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 p-2.5 rounded-xl glass transition",
          "hover:bg-black/5 dark:hover:bg-white/10"
        )}
      >
        {user ? (
          <span className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white text-[11px] font-bold flex items-center justify-center">
            {initial}
          </span>
        ) : (
          <User size={18} />
        )}
        <ChevronDown size={12} className={cn("opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl glass-strong border border-black/10 dark:border-white/10 shadow-2xl p-3 z-50">
          {user ? (
            <>
              <div className="px-3 py-2 mb-1">
                <p className="text-sm font-semibold truncate">
                  {user.user_metadata?.full_name || "User"}
                </p>
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10 transition"
              >
                <LayoutDashboard size={16} /> My Dashboard
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
              >
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <>
              <p className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                Join for free tools, history & downloads.
              </p>
              <Link
                href="/auth?mode=signup"
                onClick={() => setOpen(false)}
                className="block text-center px-4 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition mb-2"
              >
                Join Us
              </Link>
              <Link
                href="/auth?mode=login"
                onClick={() => setOpen(false)}
                className="block text-center px-4 py-2.5 rounded-xl text-sm font-semibold border border-black/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10 transition"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
