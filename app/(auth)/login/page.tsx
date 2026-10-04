"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Welcome back!", variant: "success" });
      // Admin users go straight to dashboard (hard redirect ensures server sees session)
      const next = params.get("next");
      if (next) {
        window.location.href = next;
      } else if (email.trim().toLowerCase() === "rehan.work3310@gmail.com") {
        window.location.href = "/admin";
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      toast({ title: "Login failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h1 className="font-display text-2xl font-bold mb-1">Log in</h1>
      <p className="text-sm text-zinc-500 mb-6">Access your account and admin dashboard.</p>
      <form onSubmit={login} className="space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <Button type="submit" disabled={busy} className="w-full">{busy ? "Logging in…" : "Log in"}</Button>
      </form>
      <p className="text-sm text-zinc-500 mt-5 text-center">
        No account? <Link href="/signup" className="text-brand-700 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">Sign up free</Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
