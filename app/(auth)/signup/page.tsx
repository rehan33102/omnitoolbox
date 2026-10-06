"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MailPlus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || null;
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // Auto-confirm email instantly (no OTP)
      try {
        await fetch("/api/auth/auto-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
      } catch {}
      // Sign in immediately after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Redeem an admin invite if this signup came from an invite link.
      // Never blocks signup: a failed redeem just means the default role.
      let invitedRole: string | null = null;
      if (inviteToken) {
        try {
          const res = await fetch("/api/invites/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: inviteToken }),
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.role) {
            invitedRole = json.role;
            toast({ title: "Invite accepted", description: `Your account was set up as ${json.role}.`, variant: "success" });
          } else {
            toast({ title: "Invite could not be applied", description: json.error ?? "Continuing with a standard account.", variant: "error" });
          }
        } catch {
          /* redeem failure never blocks signup */
        }
      } else {
        toast({ title: "Account created!", description: "Welcome!", variant: "success" });
      }

      // Admin users go straight to dashboard after signup (hard redirect)
      if (email.trim().toLowerCase() === "rehan.work3310@gmail.com") {
        window.location.href = "/admin";
      } else if (invitedRole === "admin" || invitedRole === "moderator") {
        window.location.href = "/admin";
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      toast({ title: "Signup failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h1 className="font-display text-2xl font-bold mb-1">Create account</h1>
      <p className="text-sm text-zinc-500 mb-6">Save prompt history and vote on AI tools.</p>
      {inviteToken && (
        <p className="flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 mb-5 bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/25">
          <MailPlus size={16} className="shrink-0" />
          You were invited to join the team — your role will be applied automatically after signup.
        </p>
      )}
      <form onSubmit={signup} className="space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" />
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Sign up free"}</Button>
      </form>
      <p className="text-sm text-zinc-500 mt-5 text-center">
        Have an account? <Link href="/login" className="text-brand-700 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">Log in</Link>
      </p>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
