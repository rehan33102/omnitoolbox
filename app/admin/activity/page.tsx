"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import type { ActivityEntry } from "@/lib/activity";

const ACTION_BADGE: Record<string, BadgeVariant> = {
  "media.uploaded": "new",
  "media.deleted": "text",
  "ad.created": "ai",
  "branding.updated": "pro",
};

function badgeFor(action: string) {
  for (const [prefix, variant] of Object.entries(ACTION_BADGE)) {
    if (action.startsWith(prefix)) return variant;
  }
  return "default" as const;
}

export default function AdminActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/activity");
        const json = await res.json();
        setEntries(json.entries ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Activity log</h1>
        <p className="text-xs text-zinc-500 mt-1">Latest admin actions, newest first.</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-14 text-zinc-500">
            <History className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No activity recorded yet</p>
            <p className="text-xs mt-1">Admin actions (uploads, deletions, config changes) will appear here.</p>
          </div>
        ) : (
          <ol className="divide-y divide-zinc-200/60 dark:divide-white/10">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeFor(e.action)}>{e.action}</Badge>
                    <span className="text-xs text-zinc-500">
                      {new Date(e.ts).toLocaleString("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-1 break-words">{e.detail}</p>
                </div>
                <span className="text-[11px] text-zinc-500 shrink-0 mt-0.5" title="Actor">
                  {e.actor}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
