"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Switch from "@/components/ui/Switch";
import { Input, Textarea } from "@/components/ui/Input";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const ROUTE_OPTIONS = [
  "/",
  "/ai-voiceover",
  "/ai-prompt-studio",
  "/calculators",
  "/media-tools",
  "/pdf-tools",
  "/social-tools",
  "/web-tools",
  "/tutorial",
  "/download",
  "/blog",
  "/contact",
  "/ai-directory",
  "/library",
  "/hire-me",
  "/privacy",
  "/terms",
];

interface Override {
  path: string;
  title: string;
  description: string;
  ogImage: string;
}

interface Settings {
  sitemap: { tools: boolean; blog: boolean; directory: boolean };
  defaults: { titleTemplate: string; description: string; ogImage: string; twitterCard: string };
  robots: { rules: string };
  verification: { google: string; bing: string };
  overrides: Override[];
  lastGenerated: string | null;
  urlCount: number | null;
  sitemapUrl: string;
  robotsUrl: string;
}

interface AuditCheck {
  name: string;
  ok: boolean;
  detail: string;
  fixHref: string;
}

function SectionTitle({ icon: Icon, title, desc }: { icon: typeof Globe; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
        <Icon size={18} />
      </span>
      <div>
        <h2 className="font-display font-semibold">{title}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

export default function AdminSeoPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [liveRobots, setLiveRobots] = useState<string | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const [audit, setAudit] = useState<{ ranAt: string; summary: { passed: number; total: number }; checks: AuditCheck[] } | null>(null);

  // Editable copies
  const [defaults, setDefaults] = useState({ titleTemplate: "", description: "", ogImage: "", twitterCard: "summary_large_image" });
  const [robotsRules, setRobotsRules] = useState("");
  const [verification, setVerification] = useState({ google: "", bing: "" });
  const [ovForm, setOvForm] = useState<Override>({ path: "/", title: "", description: "", ogImage: "" });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/seo/settings");
      if (!res.ok) throw new Error("Failed to load SEO settings");
      const json: Settings = await res.json();
      setSettings(json);
      setDefaults(json.defaults);
      setRobotsRules(json.robots.rules);
      setVerification(json.verification);
    } catch (e) {
      toast({ title: "Load failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const loadLiveRobots = useCallback(async () => {
    if (!settings) return;
    try {
      const r = await fetch(`${settings.robotsUrl}?t=${Date.now()}`);
      setLiveRobots(r.ok ? await r.text() : "Could not load robots.txt");
    } catch {
      setLiveRobots("Could not load robots.txt");
    }
  }, [settings]);

  useEffect(() => { loadLiveRobots(); }, [loadLiveRobots]);

  const save = async (payload: Record<string, unknown>, label: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/seo/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast({ title: "Saved", description: label, variant: "success" });
      return true;
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
      return false;
    }
  };

  const regenerate = async () => {
    setRegenBusy(true);
    try {
      const res = await fetch("/api/admin/seo/regenerate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "Regeneration failed");
      setSettings((s) => (s ? { ...s, lastGenerated: json.lastGenerated, urlCount: json.urlCount } : s));
      toast({ title: "Sitemap regenerated", description: `${json.urlCount} URLs counted`, variant: "success" });
    } catch (e) {
      toast({ title: "Regeneration failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setRegenBusy(false);
    }
  };

  const onToggle = async (key: "tools" | "blog" | "directory", v: boolean) => {
    if (!settings) return;
    const next = { ...settings.sitemap, [key]: v };
    setSettings({ ...settings, sitemap: next });
    const ok = await save({ sitemap: next }, `Sitemap section "${key}" ${v ? "included" : "excluded"}`);
    if (!ok) load();
  };

  const copySitemapUrl = async () => {
    if (!settings) return;
    try {
      await navigator.clipboard.writeText(settings.sitemapUrl);
      toast({ title: "Copied", description: settings.sitemapUrl, variant: "success" });
    } catch {
      toast({ title: "Copy failed", description: "Select the URL manually", variant: "error" });
    }
  };

  const saveOverrides = async (next: Override[]) => {
    const ok = await save({ overrides: next }, `${next.length} page override(s) saved — applied live`);
    if (ok) setSettings((s) => (s ? { ...s, overrides: next } : s));
  };

  const submitOverride = async () => {
    if (!settings) return;
    if (!ovForm.path.trim()) {
      toast({ title: "Path required", description: "Pick a route for this override", variant: "error" });
      return;
    }
    const next = [...settings.overrides];
    const entry: Override = { ...ovForm, path: ovForm.path.trim() };
    if (editingIdx !== null) next[editingIdx] = entry;
    else {
      const existing = next.findIndex((o) => o.path === entry.path);
      if (existing >= 0) next[existing] = entry;
      else next.push(entry);
    }
    await saveOverrides(next);
    setOvForm({ path: "/", title: "", description: "", ogImage: "" });
    setEditingIdx(null);
  };

  const deleteOverride = async (idx: number) => {
    if (!settings) return;
    await saveOverrides(settings.overrides.filter((_, i) => i !== idx));
  };

  const runAudit = async () => {
    setAuditBusy(true);
    try {
      const res = await fetch("/api/admin/seo/audit");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Audit failed");
      setAudit(json);
      toast({
        title: "Audit complete",
        description: `${json.summary.passed}/${json.summary.total} checks passed`,
        variant: json.summary.passed === json.summary.total ? "success" : "info",
      });
    } catch (e) {
      toast({ title: "Audit failed", description: e instanceof Error ? e.message : "Unknown error", variant: "error" });
    } finally {
      setAuditBusy(false);
    }
  };

  if (!settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* (a) Sitemap */}
      <Card>
        <SectionTitle
          icon={Globe}
          title="Sitemap"
          desc="Served live at /sitemap.xml — includes all enabled tools, published posts and directory listings. Cached for up to 1 hour."
        />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-5">
          <p className="text-sm text-zinc-500">
            Last regenerated:{" "}
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">
              {settings.lastGenerated ? new Date(settings.lastGenerated).toLocaleString() : "never"}
            </span>
          </p>
          <p className="text-sm text-zinc-500">
            URLs:{" "}
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">
              {settings.urlCount !== null ? settings.urlCount : "unknown — regenerate to count"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={regenerate} disabled={regenBusy}>
            <RefreshCw size={15} className={regenBusy ? "animate-spin" : ""} />
            {regenBusy ? "Regenerating…" : "Regenerate sitemap"}
          </Button>
          <Button variant="secondary" onClick={copySitemapUrl}>
            <Copy size={15} /> Copy sitemap URL
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {(
            [
              { key: "tools", label: "Tool pages", hint: "Every enabled tool URL" },
              { key: "blog", label: "Blog", hint: "/blog + published posts" },
              { key: "directory", label: "AI directory", hint: "/ai-directory + listings" },
            ] as const
          ).map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 dark:border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-zinc-500">{t.hint}</p>
              </div>
              <Switch checked={settings.sitemap[t.key]} onChange={(v) => onToggle(t.key, v)} label={t.label} />
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 p-4 text-sm">
          <p className="font-medium flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
            Search-engine ping endpoints are deprecated
          </p>
          <p className="text-zinc-600 dark:text-zinc-400 text-[13px] mb-3">
            Google retired its sitemap ping endpoint years ago and the Bing endpoint no longer accepts pings — automated
            pings fail for everyone. Submit the sitemap manually instead:
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ember-600 dark:text-ember-400 hover:underline">
              Google Search Console <ExternalLink size={13} />
            </a>
            <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ember-600 dark:text-ember-400 hover:underline">
              Bing Webmaster Tools <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </Card>

      {/* (b) Global SEO defaults */}
      <Card>
        <SectionTitle
          icon={Tag}
          title="Global SEO defaults"
          desc="Fallbacks applied to every page through buildMetadata(). Per-page overrides (below) take precedence."
        />
        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label="Title template"
            hint="Use %s for the page title, e.g. %s | Omni Tool Box. Left blank = page titles unchanged."
            value={defaults.titleTemplate}
            onChange={(e) => setDefaults({ ...defaults, titleTemplate: e.target.value })}
          />
          <Input
            label="Default OG image"
            hint="URL or site path used when a page has no image."
            value={defaults.ogImage}
            onChange={(e) => setDefaults({ ...defaults, ogImage: e.target.value })}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Default meta description"
            hint="Used only when a page provides no description of its own."
            value={defaults.description}
            onChange={(e) => setDefaults({ ...defaults, description: e.target.value })}
          />
        </div>
        <div className="mt-4 max-w-xs">
          <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Twitter card type</label>
          <select
            value={defaults.twitterCard}
            onChange={(e) => setDefaults({ ...defaults, twitterCard: e.target.value })}
            className="input-base"
          >
            <option value="summary_large_image">summary_large_image</option>
            <option value="summary">summary</option>
          </select>
        </div>
        <div className="mt-5">
          <Button onClick={() => save({ defaults }, "Global SEO defaults saved — applied live")} variant="secondary">
            <Save size={15} /> Save defaults
          </Button>
        </div>
      </Card>

      {/* (c) robots.txt */}
      <Card>
        <SectionTitle
          icon={FileText}
          title="robots.txt"
          desc="Served live at /robots.txt. Saving custom rules applies them immediately; clearing the editor restores the built-in default."
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Live content</p>
              <Button size="sm" variant="ghost" onClick={loadLiveRobots}>
                <RefreshCw size={13} /> Refresh
              </Button>
            </div>
            <pre className="rounded-2xl bg-zinc-950 text-zinc-200 text-xs p-4 overflow-auto max-h-72 whitespace-pre-wrap">
              {liveRobots ?? "Loading…"}
            </pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Custom rules</p>
            <Textarea
              value={robotsRules}
              onChange={(e) => setRobotsRules(e.target.value)}
              className="font-mono text-xs min-h-[220px]"
              hint="Plain robots.txt syntax, e.g. User-agent: * / Disallow: /admin/"
            />
            <div className="mt-3 flex gap-3">
              <Button onClick={async () => { const ok = await save({ robots: { rules: robotsRules } }, "robots.txt saved — live now"); if (ok) loadLiveRobots(); }} variant="secondary">
                <Save size={15} /> Save robots.txt
              </Button>
              <a href={settings.robotsUrl} target="_blank" rel="noopener">
                <Button variant="ghost"><ExternalLink size={15} /> View live</Button>
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* (d) Verification */}
      <Card>
        <SectionTitle
          icon={ShieldCheck}
          title="Search-engine verification"
          desc="Verification codes render as <meta> tags in the site <head> as soon as they are saved."
        />
        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label="Google site verification"
            hint="The content value from Search Console (meta tag only, not the full tag)."
            value={verification.google}
            onChange={(e) => setVerification({ ...verification, google: e.target.value })}
          />
          <Input
            label="Bing site verification"
            hint="The content value for msvalidate.01 from Bing Webmaster Tools."
            value={verification.bing}
            onChange={(e) => setVerification({ ...verification, bing: e.target.value })}
          />
        </div>
        <div className="mt-5">
          <Button onClick={() => save({ verification }, "Verification codes saved — live in <head>")} variant="secondary">
            <Save size={15} /> Save verification codes
          </Button>
        </div>
      </Card>

      {/* (e) SEO health audit */}
      <Card>
        <SectionTitle
          icon={Search}
          title="SEO health audit"
          desc="Fetches 12 main routes live and checks HTTP status, <title>, meta description, og:image, title uniqueness, 8 sampled internal links, plus sitemap.xml and robots.txt."
        />
        <Button onClick={runAudit} disabled={auditBusy} className="mb-4">
          <Play size={15} className={auditBusy ? "animate-pulse" : ""} />
          {auditBusy ? "Auditing…" : "Run audit"}
        </Button>
        {audit && (
          <div>
            <p className="text-sm text-zinc-500 mb-3">
              <span className={`font-semibold ${audit.summary.passed === audit.summary.total ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {audit.summary.passed}/{audit.summary.total} checks passed
              </span>{" "}
              · ran {new Date(audit.ranAt).toLocaleString()}
            </p>
            <ul className="space-y-2">
              {audit.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 rounded-2xl border border-black/10 dark:border-white/10 px-4 py-3">
                  {c.ok
                    ? <CheckCircle2 size={17} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    : <XCircle size={17} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-zinc-500 break-words">{c.detail}</p>
                  </div>
                  <a
                    href={c.fixHref}
                    target={c.fixHref.startsWith("http") ? "_blank" : undefined}
                    rel={c.fixHref.startsWith("http") ? "noopener" : undefined}
                    className="inline-flex items-center gap-1 text-xs font-medium text-ember-600 dark:text-ember-400 hover:underline shrink-0"
                  >
                    Fix <Link2 size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* (f) Per-page overrides */}
      <Card>
        <SectionTitle
          icon={Pencil}
          title="Per-page overrides"
          desc="Custom title / description / OG image per route. Applied live on next render via buildMetadata() — overrides beat global defaults."
        />
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300">Route</label>
            <input
              list="seo-routes"
              value={ovForm.path}
              onChange={(e) => setOvForm({ ...ovForm, path: e.target.value })}
              className="input-base"
            />
            <datalist id="seo-routes">
              {ROUTE_OPTIONS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <Input
            label="OG image"
            value={ovForm.ogImage}
            onChange={(e) => setOvForm({ ...ovForm, ogImage: e.target.value })}
          />
        </div>
        <div className="mb-4">
          <Input
            label="Title"
            value={ovForm.title}
            onChange={(e) => setOvForm({ ...ovForm, title: e.target.value })}
          />
        </div>
        <div className="mb-4">
          <Textarea
            label="Description"
            value={ovForm.description}
            onChange={(e) => setOvForm({ ...ovForm, description: e.target.value })}
          />
        </div>
        <div className="flex gap-3 mb-5">
          <Button onClick={submitOverride}>
            {editingIdx !== null ? <Pencil size={15} /> : <Plus size={15} />}
            {editingIdx !== null ? "Update override" : "Add override"}
          </Button>
          {editingIdx !== null && (
            <Button variant="ghost" onClick={() => { setEditingIdx(null); setOvForm({ path: "/", title: "", description: "", ogImage: "" }); }}>
              Cancel
            </Button>
          )}
        </div>
        {settings.overrides.length === 0 ? (
          <p className="text-sm text-zinc-500">No overrides yet — every page uses its built-in metadata plus the global defaults above.</p>
        ) : (
          <ul className="space-y-2">
            {settings.overrides.map((o, i) => (
              <li key={`${o.path}-${i}`} className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 px-4 py-3">
                <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 shrink-0">{o.path}</code>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate flex-1">{o.title || o.description || "—"}</p>
                <Button size="sm" variant="ghost" onClick={() => { setOvForm(o); setEditingIdx(i); }}>
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteOverride(i)}>
                  <Trash2 size={13} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-semibold mb-2">SEO checklist</h2>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <li>JSON-LD structured data on every page (WebSite, SoftwareApplication, Article, FAQ, Breadcrumbs)</li>
          <li>Canonical URLs + OpenGraph / Twitter cards via <code className="text-zinc-700 dark:text-zinc-300">buildMetadata()</code></li>
          <li>SSR for all marketing pages — instant indexing, no client-render delay</li>
          <li>Semantic HTML, single H1 per page, descriptive alt text</li>
        </ul>
      </Card>
    </div>
  );
}
