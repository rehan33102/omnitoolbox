"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown directly on /admin when nobody is logged in — email + password,
 * no redirect elsewhere. On success the layout re-renders as the dashboard.
 */
export default function AdminLoginForm() {
  const router = useRouter();
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
      router.refresh();
    } catch (err) {
      toast({ title: "Login failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-16 max-w-md mx-auto">
      <Card>
        <div className="flex items-center gap-3 mb-1">
          <span className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Lock size={18} />
          </span>
          <h1 className="font-display text-2xl font-bold">Admin login</h1>
        </div>
        <p className="text-sm text-zinc-500 mb-6">
          Sign in with your Gmail and password to manage the website.
        </p>
        <form onSubmit={login} className="space-y-4">
          <Input label="Gmail" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
          <Input label="Password" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-xs text-zinc-500 mt-5 text-center">
          First account to sign in becomes the admin automatically.
        </p>
      </Card>
    </div>
  );
}
