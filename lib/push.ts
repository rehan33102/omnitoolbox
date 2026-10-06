/**
 * lib/push.ts — web push helpers (SERVER-ONLY).
 *
 * VAPID config and subscriptions live in KV (seo_settings table):
 *  - "push_config": { publicKey, privateKey, subject }
 *  - "push_subscriptions": PushSubscription[] (capped)
 */
import webpush from "web-push";
import { getKV, setKV } from "@/lib/kv";

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const CONFIG_KEY = "push_config";
const SUBS_KEY = "push_subscriptions";
const MAX_SUBS = 5000;

export async function getPushConfig(): Promise<PushConfig | null> {
  const cfg = await getKV<PushConfig | null>(CONFIG_KEY, null);
  if (!cfg?.publicKey || !cfg?.privateKey) return null;
  return { publicKey: cfg.publicKey, privateKey: cfg.privateKey, subject: cfg.subject || "mailto:admin@omnitoolbox.app" };
}

export async function generatePushConfig(): Promise<PushConfig> {
  const keys = webpush.generateVAPIDKeys();
  const cfg: PushConfig = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: "mailto:admin@omnitoolbox.app",
  };
  const ok = await setKV(CONFIG_KEY, cfg);
  if (!ok) throw new Error("Failed to persist VAPID keys");
  return cfg;
}

export async function getSubscriptions(): Promise<StoredSubscription[]> {
  return getKV<StoredSubscription[]>(SUBS_KEY, []);
}

export async function addSubscription(sub: StoredSubscription): Promise<boolean> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return false;
  const subs = await getSubscriptions();
  const withoutDup = subs.filter((s) => s.endpoint !== sub.endpoint);
  withoutDup.unshift(sub);
  return setKV(SUBS_KEY, withoutDup.slice(0, MAX_SUBS));
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subs = await getSubscriptions();
  const kept = subs.filter((s) => s.endpoint !== endpoint);
  if (kept.length !== subs.length) await setKV(SUBS_KEY, kept);
}

export interface PushSendResult {
  sent: number;
  failed: number;
  pruned: number;
  total: number;
}

/** Send a push payload to every stored subscription. Prunes dead (410/404) endpoints. */
export async function sendPushToAll(title: string, body: string, url: string): Promise<PushSendResult> {
  const cfg = await getPushConfig();
  if (!cfg) throw new Error("Push not configured — generate VAPID keys first");
  const subs = await getSubscriptions();
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys } as webpush.PushSubscription,
          payload
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) dead.push(sub.endpoint);
        failed++;
      }
    })
  );

  for (const endpoint of dead) {
    // sequential prune to avoid KV write races
    await removeSubscription(endpoint);
  }

  return { sent, failed, pruned: dead.length, total: subs.length };
}
