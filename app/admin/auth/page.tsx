"use client";

import { useState } from "react";
import { Lock, Mail, UserPlus, LogIn, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Dedicated admin auth page — clean signup + login.
 * After success: hard redirect to /admin dashboard.
 */
export default function AdminAuthPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Email aur password dalo", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast({ title: "Account ban gaya!", description: "Ab login karo.", variant: "success" });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast({ title: "Welcome back, Boss!", variant: "success" });
        // Hard redirect — server picks up session immediately
        window.location.href = "/admin";
      }
    } catch (err) {
      toast({ title: mode === "signup" ? "Signup failed" : "Login failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-16 max-w-md mx-auto">
      <Card className="border-2 border-amber-500/20">
        <div className="flex items-center gap-3 mb-1">
          <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-zinc-500">Sirf owner ke liye 🔐</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 my-6 p-1 rounded-full bg-black/5 dark:bg-white/5">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all",
                mode === m
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {m === "login" ? <LogIn size={15} /> : <UserPlus size={15} />}
              {m === "login" ? "Login" : "Signup"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11"
              required
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? "Ruko..." : mode === "login" ? "Dashboard Kholo 🚀" : "Account Banao ✨"}
          </Button>
        </form>

        <p className="text-xs text-zinc-500 text-center mt-6">
          Pehli baar? <b>Signup</b> tab se account banao, phir <b>Login</b> karo.
          <br />Dashboard mein live stats, tools, ads — sab kuch!
        </p>
      </Card>
    </div>
  );
}
