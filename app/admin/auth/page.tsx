"use client";

import { useState } from "react";
import { Lock, Mail, UserPlus, LogIn, ShieldCheck, KeyRound, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Professional admin auth — Facebook-style.
 *
 * SIGNUP: email + password → OTP sent to email → enter 6-digit OTP →
 *         account verified → auto-login → dashboard.
 * LOGIN:  email + password → checks database → if verified, direct login.
 *         (OTP only needed once, during signup.)
 */
type Step = "form" | "otp";

export default function AdminAuthPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const goToDashboard = () => {
    window.location.href = "/admin";
  };

  /** After any successful auth: go to dashboard. */
  const finishAuth = async () => {
    toast({ title: "Welcome, Boss! 🎉", variant: "success" });
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

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length < 6) {
      toast({ title: "Please enter the 6-digit OTP.", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "signup",
      });
      if (error) throw error;
      await finishAuth();
    } catch (err) {
      toast({ title: "Incorrect OTP", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (error) throw error;
      toast({ title: "OTP resent! 📧", variant: "success" });
    } catch (err) {
      toast({ title: "Resend failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const backToForm = () => {
    setStep("form");
    setOtp("");
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
            <p className="text-sm text-zinc-500">Owner access only 🔐</p>
          </div>
        </div>

        {step === "otp" ? (
          /* ============ OTP VERIFICATION STEP ============ */
          <div className="mt-6">
            <div className="text-center mb-6">
              <span className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCircle2 size={24} />
              </span>
              <h2 className="font-bold text-lg">Verify Your Email</h2>
              <p className="text-sm text-zinc-500 mt-1">
                We&apos;ve sent a 6-digit OTP to <b>{email}</b>.
                <br />Enter the code here:
              </p>
            </div>
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl font-mono tracking-[0.5em] py-4"
                maxLength={6}
                required
                autoFocus
              />
              <Button type="submit" disabled={busy} className="w-full" size="lg">
                {busy ? "Verifying..." : "Verify & Open Dashboard 🚀"}
              </Button>
            </form>
            <div className="flex justify-between mt-4 text-sm">
              <button onClick={backToForm} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                ← Back
              </button>
              <button
                onClick={resendOtp}
                disabled={busy}
                className="text-amber-600 dark:text-amber-400 font-semibold hover:underline disabled:opacity-50"
              >
                Resend OTP
              </button>
            </div>
          </div>
        ) : (
          /* ============ LOGIN / SIGNUP FORM ============ */
          <>
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
                {busy ? "Please wait..." : mode === "login" ? "Open Dashboard 🚀" : "Create Account ✨"}
              </Button>
            </form>

            <p className="text-xs text-zinc-500 text-center mt-6">
              {mode === "signup" ? (
                <>Your account will be created instantly — the dashboard opens right away!</>
              ) : (
                <>First time here? Create an account from the <b>Signup</b> tab, then <b>Log in</b>.</>
              )}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
