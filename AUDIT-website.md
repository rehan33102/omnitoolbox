# OmniToolBox Website Audit — 2026-10-05

Professional code audit (Meta dev-team style). Scope: Chrome + general bugs across
`~/workspace/omnitoolbox` (Next.js 14.2.4). Audit only — nothing fixed.

Severity: CRITICAL (security/data-loss) · HIGH (broken feature / major UX) ·
MEDIUM (degraded UX / perf / maintainability) · LOW (nit / future).

---

## CRITICAL

### C-1. Hardcoded admin master bypass key in source — `middleware.ts:5,10-20`
`const BOSS_KEY = "boss-x7k9m2-2026"` committed in plaintext. `?boss=...` on any
`/admin/*` or `/api/admin/*` URL sets a 1-year `boss_key` cookie and skips ALL
auth. Key leaks via URL into browser history, server logs, Referer headers.
Anyone with repo read access (git history included) has permanent admin.
**Fix:** delete the bypass; use env-var-only one-time token compared server-side,
never stored in repo; rotate credentials.

### C-2. `app/api/admin/confirm-email/route.ts:8-31` — privileged endpoint, no in-route auth
`POST` runs `admin.auth.admin.updateUserById(..., { email_confirm: true })`
(service-role) for a hardcoded owner email, guarded only by an email-string check
(line 12) and the middleware matcher — which C-1 defeats. Zero frontend callers
(dead code) + security liability + leaks raw error text (line 31).
**Fix:** delete the route entirely (use Supabase dashboard for one-off confirms).

---

## HIGH

### H-1. AutoUpdater is silently dead — `/api/site-version` statically rendered
`app/api/site-version/route.ts` (new, commit 0b343e8) has no
`export const dynamic = "force-dynamic"`. Next statically evaluates the GET at
build time, so it returns the **build-time git hash forever** — the
`components/AutoUpdater.tsx:25` poll can never detect a new deploy, and users do
NOT auto-update. Same staleness affects `/api/tools` (admin tool changes invisible
until redeploy) and `/api/stats/public` (homepage UsageCounter frozen at
build-time value).
**Fix:** add `export const dynamic = "force-dynamic";` to `/api/site-version`,
`/api/tools`, `/api/stats/public` (and harmless on `/api/voiceover/config`,
`/api/app-version`). Verified: zero `dynamic` exports exist under `app/api/`.

### H-2. Dead Video Generator shipped live — `components/video/VideoGenerator.tsx:81,116`
Calls `/api/video-generator/generate` and `/api/video-generator/status/[id]` —
**no such routes exist** (`app/api/` has no `video-generator/` dir). Still
registered in `app/tools/[slug]/page.tsx:41` and linked from Library
(`components/library/LibraryClient.tsx:48`). Users open a tool that always fails.
User rule: remove what doesn't genuinely work.
**Fix:** remove the registry entry + component + `scripts/video-queue-worker.mjs`,
`scripts/video-worker.mjs`, `supabase/migrations/009_video_jobs.sql`,
`public/videos/generated/` remnants.

### H-3. No rate limit on public TTS endpoint — `app/api/voiceover/synthesize/route.ts:163-208`
600 chars/request, Edge TTS (3 retries w/ backoff) + Google fallback;
`maxDuration = 60`. Any bot can tie up serverless instances and burn upstream
quotas. `analytics/track` and `directory/vote` already use `lib/rate-limit.ts`;
this one doesn't.
**Fix:** IP-based rate limit (20–30 req/min) at top of POST, like
`app/api/analytics/track/route.ts:21`.

### H-4. No rate limit / timeout on bg-remove proxy — `app/api/bg-remove/route.ts:9-45`
Public endpoint proxies ≤10MB images to `api.nobg.akshit.io` (quota 5 req/min,
20/day **per shared Vercel egress IP** — one attacker burns the whole site's
quota). No `AbortSignal` timeout on upstream fetch (line 33): a hung upstream
holds the function the full 60s `maxDuration`.
**Fix:** IP rate limit (~10/min), `AbortSignal.timeout(20000)` on upstream fetch.

### H-5. Chrome blocks unmuted autoplay — `components/media/WatermarkRemover.tsx:645`
`<video src={videoUrl} controls playsInline autoPlay loop …>` has no `muted`.
Chrome's autoplay policy blocks unmuted autoplay → the processed-video preview
doesn't play automatically on Chrome (desktop + mobile).
**Fix:** add `muted` (or drop `autoPlay`).

---

## MEDIUM

### M-1. `lib/download.ts:8-21` — blob URL revoked after fixed 4s
If the browser/OS shows a "save to…" picker or delays the download (common on
mobile), revoking the object URL at 4s can abort it. The user's "nothing shows
on download" complaint on mobile may partly stem from this.
**Fix:** revoke on `window` `pagehide` or after 60s, not 4s; keep the anchor
removal as-is.

### M-2. Tutorial videos bypass the service worker cache — `public/sw.js`
`isStaticAsset()` doesn't match `.mp4`; tutorial MP4s fall through to
network-first and are never cached by the SW. Combined with 60MB of MP4s in
`public/tutorials/`, every visit re-downloads video bytes (browser HTTP cache
helps now via `vercel.json`, but SW offline/repeat views still re-fetch).
**Fix:** add `url.pathname.endsWith(".mp4")` (or `/tutorials/` prefix) to
`isStaticAsset()`, or a cache-first branch for `/tutorials/*`.

### M-3. Dead 9MB tutorial video in repo — `public/tutorials/omnitoolbox-tutorial.mp4`
Zero references in `app/`/`components/` (page uses `-v2.mp4`). 9MB of dead
weight in git history; repo already 261MB with 110MB PC zip + 60MB tutorials.
**Fix:** delete the file (and consider Git LFS or external hosting for videos).

### M-4. File-size checks after full body parse — `app/api/library/route.ts:27-37`, `app/api/bg-remove/route.ts:11-24`
`await req.formData()` reads the entire upload into memory before the 50MB/10MB
limit is enforced. Multi-GB upload can OOM the function (DoS).
**Fix:** pre-check `Content-Length` header before parsing.

### M-5. Analytics rate-limit evasion — `app/api/analytics/track/route.ts:21`
Key `track:${ip}:${toolSlug}` — attacker rotates slugs to bypass the 60/min cap
and spam `analytics_events` rows.
**Fix:** add a per-IP base limit (e.g. `track:${ip}` at 300/min) alongside.

### M-6. Non-atomic vote increment — `app/api/directory/vote/route.ts:34-39`
Read-modify-write (`select` then `update({votes: votes+1})`) races under
concurrent votes; counts drift. `viewer` is client-supplied (stuffing trivial
beyond the 30/min IP limit).
**Fix:** Supabase RPC with atomic `votes = votes + 1`.

### M-7. Unclamped TTS params — `app/api/voiceover/synthesize/route.ts`, `lib/edge-tts.ts:664-665`
`ratePct`/`pitchHz` accepted from body and passed into SSML unclamped (only
`pauseSec` is clamped). Caller can inject extreme values (e.g. `ratePct:
999999`). `voiceId`/`speed` parsed but silently ignored (dead params);
`VOICE_ID_RE` (line 12) defined but never used.
**Fix:** clamp `ratePct` to [-40,40], `pitchHz` to [-15,15]; drop or reject
`voiceId`/`speed`.

### M-8. `min-h-screen` (100vh) on mobile Chrome — `app/layout.tsx:66`
Tailwind 3.4.4 `min-h-screen` = `100vh`, which on Chrome mobile includes the
area behind the dynamic URL bar → slight vertical overflow/jump when the bar
hides. No `svh`/`dvh` usage anywhere.
**Fix:** use `min-h-svh` (or `min-h-dvh`) for the body wrapper.

### M-9. Unauthenticated library GET returns 200 empty — `app/api/library/route.ts:76-79`
`GET` without auth returns `{ items: [] }` (hides "not signed in"; POST/DELETE
correctly return 401).
**Fix:** return 401 like the other methods.

### M-10. Library storage abuse surface — `app/api/library/route.ts`
Authenticated but unthrottled: 50MB uploads, no per-user quota, no MIME
allowlist (content-type client-controlled, lines 49-50).
**Fix:** rate limit + per-user quota (e.g. 500MB) + MIME allowlist per kind.

---

## LOW

- **L-1.** `lib/rate-limit.ts:1` — in-memory Map, no cross-instance sharing on
  Vercel, entries never expire (slow leak). Fine at current scale; add a sweep
  or Upstash Redis later.
- **L-2.** `next.config.mjs:8-9` — `images.remotePatterns: [{ hostname: "**" }]`
  lets `next/image` proxy arbitrary hosts (bandwidth/DoS vector). Restrict to
  known hosts (Supabase, Pixabay).
- **L-3.** Missing security headers: no CSP, no HSTS (X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy already set — good).
- **L-4.** `app/api/library/route.ts:6,77,112` — doc comments reference
  non-existent paths (`/api/library/upload`, `/list`, `/delete`); real path is
  `/api/library`. Misleading for maintainers.
- **L-5.** Raw `error.message` returned to clients on admin routes
  (`confirm-email:31` et al.) — can leak schema hints. Log server-side, return
  generic message.
- **L-6.** No `-webkit-tap-highlight-color` reset in `app/globals.css` — tap
  flash on Chrome mobile links/buttons.
- **L-7.** `app/download/page.tsx:42` claims APK "Auto-updates with website" —
  only web content auto-updates; the APK binary needs manual reinstall (or the
  `/api/app-version` in-app updater). Reword to avoid misleading users.
- **L-8.** `components/media/SvgCleaner.tsx:75` renders user SVG via
  `dangerouslySetInnerHTML` — inherent to an SVG-cleaner preview, but a
  malicious SVG could execute script in preview. Sanitize or sandbox if
  user-uploaded SVGs are previewed.
- **L-9.** `public/sw.js` cache name `omnitoolbox-v8` not bumped after recent
  deploys — harmless (Next static assets are content-hashed; pages are
  network-first), but bump on SW logic changes.
- **L-10.** `app/api/site-version/route.ts:8` `execSync("git rev-parse")` —
  not a crash/injection risk (fixed string, 5s timeout, try/catch, falls back to
  `VERCEL_GIT_COMMIT_SHA`); the real problem is H-1, not the exec.

---

## Verified working (downloads)

All download paths audited; programmatic downloads now attach the anchor to the
DOM before `.click()` via `lib/download.ts`:

| Tool | Mechanism | Status |
|---|---|---|
| BG Studio (HD + Quick) | `downloadBlob` | ✅ fixed (7eb307a) |
| Thumbnail Maker | `downloadUrl` (data URL) | ✅ fixed |
| Watermark Remover (image) | `downloadUrl` (blob URL) | ✅ fixed |
| Voiceover (generate + history) | `downloadBlob` | ✅ fixed |
| QR Generator (PNG + SVG) | in-DOM append + `a.remove()` | ✅ OK |
| Library (per-item) | in-DOM append + `a.remove()` | ✅ OK |
| PDF Merger / Splitter / Images-to-PDF | in-DOM `<a href download>` | ✅ OK |
| Background Remover | in-DOM `<a href download>` | ✅ OK |
| Image Converter / Compressor | in-DOM `<a href download>` | ✅ OK |
| APK (download page) | `<a href download>` | ✅ OK |

Desktop Chromium live test (2026-10-05): BG Studio HD + Quick PNG both
triggered real downloads with success toasts, zero console errors. Mobile
"nothing shows" could not be reproduced on desktop — likely mobile-WebView /
mobile-Chrome blob-download behavior (see M-1); needs a real-device check.

---

## Frontend (React/Next.js) findings

### HIGH

**F-1. Hydration mismatch — `components/social/HashtagFinder.tsx:67, 85, 87`**
`Math.random()` shuffle inside `useMemo` runs during render. Server-rendered tag
order ≠ client-hydrated order → React hydration mismatch on
`/tools/hashtag-finder`, plus reshuffles on unrelated re-renders.
**Fix:** move shuffle into the click/generate handler or a mount-only
`useEffect` (store shuffled tags in state); render from state.

**F-2. Hydration mismatch — `components/voice/VoiceoverStudio.tsx:553`**
`Date.now()` embedded in the `download` attribute during render:
``download={`voiceover-${lang}-${Date.now()}.mp3`}``. Server and client render
different attribute values → hydration mismatch warning on the ai-voiceover page.
**Fix:** compute the filename once in the generate handler (state/ref) and
reference it in render.

### MEDIUM

**F-3. Library thumb URL leak — `components/library/LibraryClient.tsx:89-92`**
Unmount cleanup closes over the initial empty `thumbs` (`Object.values(thumbs)`
with `[]` deps + eslint-disable). Thumb object URLs created later are never
revoked → leak grows with library use.
**Fix:** keep thumbs in a ref, or revoke old map before `setThumbs` in `load`.

**F-4. Library audio preview leak — `components/library/LibraryClient.tsx:108`**
`audio.src = URL.createObjectURL(entry.blob)` without revoking previous
`audio.src` → one leaked blob URL per track preview.
**Fix:** revoke old `audio.src` if it starts with `blob:` before assigning.

**F-5. Object URLs never revoked (leak per conversion)**
`BackgroundRemover.tsx:199,218,246`, `ImageConverter.tsx:41,72`,
`ImageCompressor.tsx:47,88`, `PdfMerger.tsx:95`, `PdfSplitter.tsx:85`,
`ImagesToPdf.tsx:120` (ImagesToPdf revokes file previews on remove but not the
result URL).
**Fix:** revoke previous URL before `setResult`/`setPreview`; add unmount
cleanup effect.

**F-6. VoiceoverStudio leaks + audio keeps playing after unmount —
`components/voice/VoiceoverStudio.tsx`**
Generated `audioUrl` (~:277) never revoked on unmount; `new Audio(url)` from
`playHistory` (:338) keeps playing after unmount; in `previewVoice` (:202-208)
if `el.play()` throws after `src` set, the blob URL is never revoked.
**Fix:** `useEffect(() => () => { audioRef.current?.pause(); revoke audioUrl },
[])` (ref for the URL to avoid stale closure).

**F-7. Fullscreen state desync — `components/tutorial/TutorialVideo.tsx`**
No `fullscreenchange` listener: pressing ESC (or Android gesture) exits native
fullscreen while `isFull` stays `true` → wrong icon, next toggle takes the wrong
branch. Matches the user's "fullscreen/enlarge broken" complaints.
**Fix:** `document.addEventListener("fullscreenchange", …)` in an effect to sync
`isFull`; keep CSS-fallback path.

### LOW

**F-8.** `components/layout/Footer.tsx:107` — `new Date().getFullYear()` in render
(midnight-NYE hydration edge). Compute on mount or hardcode.
**F-9.** `components/calc/AgeCalculator.tsx:65,16-17` — `new Date()` in render +
`useMemo`; midnight-boundary hydration risk. Compute once on mount.
**F-10.** Unused imports (tree-shaken, cosmetic): `saveBlob` imported but unused
in VoiceoverStudio:9, ImageConverter:10, WatermarkRemover:22, ThumbnailMaker,
BackgroundStudio, BackgroundRemover, ImageCompressor (all use `saveToLibrary`);
`Button` + `FileText` unused in VoiceoverStudio:4,9; `Sparkles` unused in
BackgroundRemover:4. Remove them.
**F-11.** `components/prompt-studio/PromptBuilder.tsx:284` — `key={i}` on a list
that prepends → React reuses wrong DOM nodes. Use stable key.
**F-12.** `app/admin/settings/page.tsx:33` — eslint-disable masks missing
`settings` dep; form won't re-sync if settings change. Include dep or split into
keyed child.
**F-13.** `components/ui/Button.tsx:31` — no default `type="button"`; latent
accidental-submit risk in future forms. Default `type="button"`.
**F-14.** `components/analytics/TrackUsage.tsx:9-11` — `page_view` double-fires
under StrictMode (dev) and on slug remounts. Guard with a ref.
**F-15.** `TutorialVideo.tsx` a11y — seek bar is a clickable `<div>` (no
`role="slider"`/keyboard); time readout reads `videoRef.current` in render.
Make it a real slider with arrow-key handling.

### Checked and clean (no action)

All `@/` imports resolve; keys stable on Toast/ThumbnailMaker/BackgroundStudio/
PromptBuilder/BioGenerator/Hero/ArticleBody/admin skeletons/blog tags;
interval/listener cleanups present (UsageCounter, AutoUpdater, SmartSearch,
Modal, Drawer, InstallPrompt, QrGenerator, useSiteSettings, useAdminBlogPosts,
useToolOverrides, useReveal, WatermarkRemover); all 4 forms use
`<Button type="submit">` correctly; `next/image` usages have width/height;
`suppressHydrationWarning` on `<html>` (layout:65) is the legitimate next-themes
pattern; no `useState(new Date())`, no `key={Math.random()}`; `localStorage` in
effects/handlers only; admin pages guard API JSON with `?? []`/`?.`.

---

## Performance notes

- 22 tool components load via `next/dynamic` — good code-splitting; `pdf-lib`,
  `recharts` (admin-only) don't bloat the homepage bundle.
- `optimizePackageImports: ["lucide-react"]` set — good.
- 13 plain `<img>` vs 6 `next/image` usages — tool-card images in
  `public/images/tools/` (~300-400KB each) could use `next/image` for
  responsive sizing; moderate win.
- `public/tutorials/` = 60MB in git; `public/downloads/` = ~114MB in git.
  Vercel serves them fine, but repo clone/push is slow and Vercel has asset
  limits — consider external hosting (R2/Supabase storage) long-term.

---

*Audit completed 2026-10-05. No files modified (audit only).*
*Sections: downloads + dead code + perf + Chrome (lead); API routes (child
8ffaa33a); React/Next.js frontend (child 1259a9bb).*
