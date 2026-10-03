/**
 * lib/tool-overrides.ts — client-side overrides for tool edits made in /admin/tools.
 *
 * Saved to IndexedDB (records store, kind "tool-overrides", one row keyed by slug)
 * + localStorage mirror. The homepage merges these over the server-provided tool
 * list so admin edits (title, tagline, image, enabled, sort order…) show up
 * immediately without waiting for the server cache to refresh.
 */
import { getNamedRecord, listNamedRecords, saveNamedRecord, deleteNamedRecord } from "@/lib/db";
import type { Tool } from "@/types";

export type ToolOverride = Partial<Tool> & { slug: string; updatedAt: string };

const KIND = "tool-overrides";
export const TOOL_OVERRIDES_EVENT = "otb:tool-overrides-updated";

function notify(map: Record<string, ToolOverride>) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<Record<string, ToolOverride>>(TOOL_OVERRIDES_EVENT, { detail: map }));
  }
}

export async function getToolOverrides(): Promise<Record<string, ToolOverride>> {
  const rows = await listNamedRecords<ToolOverride>(KIND);
  const map: Record<string, ToolOverride> = {};
  for (const r of rows) map[r.id] = r.data;
  return map;
}

export async function getToolOverride(slug: string): Promise<ToolOverride | null> {
  return getNamedRecord<ToolOverride>(KIND, slug);
}

export async function saveToolOverride(slug: string, data: ToolOverride): Promise<void> {
  await saveNamedRecord<ToolOverride>(KIND, slug, { ...data, slug, updatedAt: new Date().toISOString() });
  notify(await getToolOverrides());
}

export async function deleteToolOverride(slug: string): Promise<void> {
  await deleteNamedRecord(KIND, slug);
  notify(await getToolOverrides());
}

/**
 * Merge server tools with client overrides. Overrides win per-field;
 * disabled tools are filtered out; result is sorted by sortOrder.
 * Overrides for slugs unknown to the server are treated as new tools.
 */
export function applyToolOverrides(tools: Tool[], overrides: Record<string, ToolOverride>): Tool[] {
  const seen = new Set<string>();
  const merged: Tool[] = tools.map((t) => {
    seen.add(t.slug);
    const o = overrides[t.slug];
    return o ? ({ ...t, ...o, slug: t.slug } as Tool) : t;
  });
  for (const [slug, o] of Object.entries(overrides)) {
    if (!seen.has(slug) && o.title && o.href) {
      merged.push({
        id: `override-${slug}`,
        slug,
        title: o.title,
        tagline: o.tagline ?? "",
        description: o.description ?? "",
        category: o.category ?? "web",
        href: o.href,
        icon: o.icon ?? "Wrench",
        keywords: o.keywords ?? [],
        badge: o.badge,
        image: o.image,
        enabled: o.enabled ?? true,
        sortOrder: o.sortOrder ?? 99,
        usageCount: 0,
        updatedAt: o.updatedAt ?? new Date().toISOString(),
      });
    }
  }
  return merged
    .filter((t) => t.enabled)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
}
