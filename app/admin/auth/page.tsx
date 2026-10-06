"use client";

import { useEffect, useState } from "react";
import { Lock, Mail, UserPlus, LogIn, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Professional admin auth — Facebook-style.
 *
 * SIGNUP: email + password → instant activation → auto-login → dashboard.
 * LOGIN:  email + password → direct login → dashboard.
 * (No OTP anywhere — removed per owner directive.)
 */

export default function AdminAuthPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const goToDashboard = () => {
    window.location.href = "/admin";
  };

  // Already signed in? Skip the form — go straight to the dashboard.
  // (Single deterministic redirect; never loops.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!cancelled && data?.user) window.location.href = "/admin";
      } catch {
        /* stay on the form */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** After any successful auth: go to dashboard. */
  const finishAuth = async () => {
    toast({ title: "Welcome back!", variant: "success" });
    goToDashboard();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Please enter your email and password", variant: "error" });
      return;
    }
    if (mode === "signup" && password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        // Create account — NO OTP, instant activation
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        // Auto-confirm instantly
        await fetch("/api/auth/auto-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        }).catch(() => {});
        // Sign in directly
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError) throw loginError;
        await finishAuth();
      } else {
        // Login — direct, no OTP (already verified during signup)
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          // Helpful message if email not yet verified
          if (error.message.toLowerCase().includes("email not confirmed")) {
            throw new Error("Email not verified. Please sign up again.");
          }
          throw error;
        }
        await finishAuth();
      }
    } catch (err) {
      toast({
        title: mode === "signup" ? "Signup failed" : "Login failed",
        description: (err as Error).message,
        variant: "error",
      });
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
            <p className="text-sm text-zinc-500">Owner access only</p>
          </div>
        </div>

        {/* ============ LOGIN / SIGNUP FORM ============ */}
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

        <form onSubmit={handleFormSubmit} className="space-y-4">
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
              placeholder={mode === "signup" ? "Password (min 6 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? "Please wait..." : mode === "login" ? "Open Dashboard" : "Create Account"}
          </Button>
        </form>

        <p className="text-xs text-zinc-500 text-center mt-6">
          {mode === "signup" ? (
            <>Your account will be created instantly — the dashboard opens right away!</>
          ) : (
            <>First time here? Create an account from the <b>Signup</b> tab, then <b>Log in</b>.</>
          )}
        </p>
      </Card>
    </div>
  );
}
