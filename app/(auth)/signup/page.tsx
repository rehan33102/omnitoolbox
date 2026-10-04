"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
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
      toast({ title: "Account created!", description: "Check your email to confirm.", variant: "success" });
      // Admin users go straight to dashboard after signup (hard redirect)
      if (email.trim().toLowerCase() === "rehan.work3310@gmail.com") {
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
      <p className="text-sm text-zinc-500 mb-6">Free forever. Save prompt history and vote on AI tools.</p>
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
