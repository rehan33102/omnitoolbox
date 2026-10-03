"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

interface SeoState {
  lastGenerated: string | null;
  pings: { engine: string; ok: boolean }[] | null;
}

export default function AdminSeoPage() {
  const [state, setState] = useState<SeoState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admin/seo/regenerate");
    if (res.ok) setState(await res.json());
  };
  useEffect(() => { load(); }, []);

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seo/regenerate", { method: "POST" });
      const json = await res.json();
      setState(json);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold">Dynamic sitemap</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Served at <code className="text-zinc-700 dark:text-zinc-300">/sitemap.xml</code> — includes all enabled tools,
              published posts and directory listings. Cached for 1 hour, regenerates on demand.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Last regenerated:{" "}
              <span className="text-zinc-700 dark:text-zinc-300">
                {state ? (state.lastGenerated ? new Date(state.lastGenerated).toLocaleString() : "never") : <Skeleton className="inline-block h-3 w-24" />}
              </span>
            </p>
          </div>
          <Button onClick={regenerate} disabled={busy}>
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            {busy ? "Regenerating…" : "Regenerate & ping"}
          </Button>
        </div>

        {state?.pings && (
          <div className="mt-4 space-y-2">
            {state.pings.map((p) => (
              <div key={p.engine} className="flex items-center gap-2 text-sm">
                {p.ok
                  ? <CheckCircle2 size={15} className="text-emerald-700 dark:text-emerald-400" />
                  : <XCircle size={15} className="text-red-600 dark:text-red-400" />}
                <span className="text-zinc-700 dark:text-zinc-300">{p.engine}</span>
                <span className="text-xs text-zinc-500">{p.ok ? "sitemap ping accepted" : "ping failed"}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <a href={`${origin()}/sitemap.xml`} target="_blank" rel="noopener">
          <Card hover className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">View sitemap.xml</p>
              <p className="text-xs text-zinc-500">Live XML output</p>
            </div>
            <ExternalLink size={16} className="text-zinc-500" />
          </Card>
        </a>
        <a href={`${origin()}/robots.txt`} target="_blank" rel="noopener">
          <Card hover className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">View robots.txt</p>
              <p className="text-xs text-zinc-500">Crawl rules</p>
            </div>
            <ExternalLink size={16} className="text-zinc-500" />
          </Card>
        </a>
      </div>

      <Card>
        <h2 className="font-display font-semibold mb-2">SEO checklist</h2>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
          <li>✓ JSON-LD structured data on every page (WebSite, SoftwareApplication, Article, FAQ, Breadcrumbs)</li>
          <li>✓ Canonical URLs + OpenGraph / Twitter cards via <code className="text-zinc-700 dark:text-zinc-300">buildMetadata()</code></li>
          <li>✓ SSR for all marketing pages — instant indexing, no client-render delay</li>
          <li>✓ Dynamic OG images via <code className="text-zinc-700 dark:text-zinc-300">app/opengraph-image.tsx</code></li>
          <li>✓ Semantic HTML, single H1 per page, descriptive alt text</li>
        </ul>
      </Card>
    </div>
  );
}
