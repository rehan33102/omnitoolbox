"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Mail, Lock, KeyRound, LogIn, UserPlus, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Public user auth — /auth
 *
 * SIGNUP: Full Name + Gmail + Password + Confirm Password
 *         → Supabase signUp (full_name in user_metadata)
 *         → 6-digit OTP emailed → verifyOtp(type='signup') → /dashboard
 * LOGIN:  Email + Password (case-insensitive)
 *         → smart errors: "Account not registered…" vs "Invalid credentials…"
 */
type Mode = "login" | "signup";
type Step = "form" | "otp";

const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

/**
 * Probe whether an email is already registered.
 * Uses signUp semantics: Supabase returns the existing user with an empty
 * `identities` array (or an "already registered" error) instead of creating
 * a duplicate. Any session accidentally created by the probe is signed out.
 * Returns null when inconclusive.
 */
async function emailIsRegistered(email: string): Promise<boolean | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: `__probe__${crypto.randomUUID()}__${Date.now()}`,
    });
    if (data?.session) {
      await supabase.auth.signOut().catch(() => {});
    }
    if (error) return true; // e.g. "User already registered"
    const identities = (data?.user as unknown as { identities?: unknown[] } | null)?.identities;
    if (Array.isArray(identities) && identities.length === 0) return true;
    return false;
  } catch {
    return null;
  }
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(() =>
    params.get("mode") === "signup" ? "signup" : "login"
  );
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const nextUrl = params.get("next") || "/dashboard";

  const goNext = () => {
    // Hard redirect so the server picks up the fresh session cookie immediately.
    window.location.href = nextUrl;
  };

  const validateSignup = (): string | null => {
    if (fullName.trim().length < 2) return "Please enter your full name.";
    if (!GMAIL_RE.test(email.trim()))
      return "Please use a valid Gmail address (example@gmail.com).";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      const supabase = createClient();

      if (mode === "signup") {
        const problem = validateSignup();
        if (problem) {
          toast({ title: problem, variant: "error" });
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        // NO OTP — auto-confirm instantly via server
        await fetch("/api/auth/auto-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail }),
        }).catch(() => {});
        // Now sign in directly
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (loginError) throw loginError;
        toast({
          title: "Account ban gaya! 🎉",
          description: "Welcome to Omni Tool Box!",
          variant: "success",
        });
        goNext();
        return;
      }

      // ---- LOGIN (smart, case-insensitive) ----
      if (!cleanEmail || !password) {
        toast({ title: "Email aur password dalo", variant: "error" });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          throw new Error("Email not verified yet. Please sign up again to get a fresh OTP.");
        }
        if (msg.includes("invalid login credentials")) {
          const exists = await emailIsRegistered(cleanEmail);
          if (exists === false) {
            throw new Error("Account not registered. Please sign up first.");
          }
          throw new Error("Invalid credentials. Please verify your password.");
        }
        throw error;
      }
      toast({ title: `Welcome back!`, variant: "success" });
      goNext();
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
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: "signup",
      });
      if (error) throw error;
      toast({ title: `Welcome, ${fullName.trim().split(" ")[0]}! 🎉`, variant: "success" });
      goNext();
    } catch (err) {
      toast({ title: "Wrong OTP", description: (err as Error).message, variant: "error" });
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
        email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      toast({ title: "OTP resent! 📧", variant: "success" });
    } catch (err) {
      toast({ title: "Resend failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-2 border-brand-500/20">
      <div className="flex items-center gap-3 mb-1">
        <span className="p-2.5 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white">
          <User size={22} />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Your Account</h1>
          <p className="text-sm text-zinc-500">Save work, sync library, vote on tools ✨</p>
        </div>
      </div>

      {step === "otp" ? (
        <div className="mt-6">
          <div className="text-center mb-6">
            <p className="text-sm text-zinc-500 mt-1">
              Account ban raha hai...
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 my-6 p-1 rounded-full bg-black/5 dark:bg-white/5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-all",
                  mode === m
                    ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-lg"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                {m === "login" ? <LogIn size={15} /> : <UserPlus size={15} />}
                {m === "login" ? "Login" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-11"
                  required
                  autoComplete="name"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                type="email"
                placeholder={mode === "signup" ? "Gmail address" : "Email address"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11"
                required
                autoComplete="email"
                hint={undefined}
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
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            {mode === "signup" && (
              <div className="relative">
                <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-11"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? "Please wait…" : mode === "login" ? "Log in 🚀" : "Create Account 🎉"}
            </Button>
          </form>

          <p className="text-xs text-zinc-500 text-center mt-6">
            {mode === "signup" ? (
              <>Account turant ban jayega — koi OTP nahi! Already registered?{" "}
                <button onClick={() => setMode("login")} className="text-brand-700 dark:text-brand-400 font-semibold hover:underline">Log in</button></>
            ) : (
              <>New here?{" "}
                <button onClick={() => setMode("signup")} className="text-brand-700 dark:text-brand-400 font-semibold hover:underline">Create a free account</button></>
            )}
          </p>
          <p className="text-xs text-zinc-500 text-center mt-3">
            <Link href="/" className="hover:underline">← Back to tools</Link>
          </p>
        </>
      )}
    </Card>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
