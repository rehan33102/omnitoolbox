# Admin Overhaul Spec — research groundwork (2026-10-06)

User's explicit asks (main chat, 15:04–15:11 UTC): (1) manual ad system, (2) ad delete fix, (3) dashboard live stats clickable + live counter fixed, (4) branding section + deep analysis of branded dashboards, (5) SEO section fixed + deepened, (6) zero "failed" anywhere, (7) users section showing data + full admin control. Assistant in chat promised all of it. This doc = the "deep analysis" groundwork, mapped to OmniToolBox constraints (Next.js, free Vercel plan, Supabase, website+app+PC, zero budget).

**Cross-cutting architecture rule (critical):** user said save/update must go live instantly with NO rebuild and NO "update popup" on website/app/PC. That means: ad/branding/SEO/user settings live in Supabase tables read at RUNTIME (client fetch or /api config), never baked into the build. Admin saves → writes DB → public pages re-read → instant. No PWA update-prompt anywhere.

**Zero-failed gate:** any feature that cannot genuinely work is REMOVED, not left showing "failed". (Precedent: SEO "ping" endpoints no longer exist — Google/Bing sitemap pings were deprecated; that's why it showed failed. Replace with: submit sitemap URL in Search Console + Instant Indexing via IndexNow API, which still works.)

---

## 1. Ad system (manual, Ad Inserter-style)

Standard in WordPress ad managers (Ad Inserter / Advanced Ads): blocks with placement rules, scheduling, stats.

- **Ad record:** name, image upload (media library), destination link, animation style (slide-up / fade / pop / top-banner / interstitial), display duration in seconds/minutes (auto-dismiss timer, optional), close (✕) button.
- **Placement:** checklist of ALL site pages (~38) with toggles — multiple selection allowed (user's exact ask).
- **Behavior:** click anywhere on ad → redirect to destination link (open new tab). ✕ hides ad for this visit only (sessionStorage flag); next visit shows it again (user's exact ask).
- **Scheduling:** start/end datetime (campaign-style, like Ad Inserter scheduling), optional.
- **Stats:** impressions + clicks per ad (simple counters table) — needed so admin can see what works.
- **Delete must hard-delete** the record + image reference (user reported delete doesn't work — root cause to verify, likely soft-delete/UI-only).
- No ad should ever block the app/PC builds — same component, responsive.

## 2. Branding section (where site name changes)

What branded platforms expose (WordPress Customizer / Ghost settings):
- Site name, tagline/description, logo upload, favicon upload, theme color picker (accent), footer text, social links (YouTube, TikTok, Instagram, X…), all applied live via runtime config.
- Media library: one place for logo, ad images, blog images, thumbnails (Ghost/WordPress standard).

## 3. SEO section (RankMath-style, minus the dead "ping")

RankMath/Yoast free feature set, adapted to a Next.js site:
- Global defaults: meta title/description template, default share image, Twitter card type.
- Per-page title/description editor (all ~38 pages listed, bulk-edit table like RankMath).
- robots.txt live editor + XML sitemap auto-generated (sitemap.xml route, not a "ping").
- Webmaster verification fields: Google + Bing meta tags (real, works) — NOT the dead ping buttons (remove them).
- SEO health audit button: real scan — missing titles/descriptions, broken internal links, images without alt, pages missing OG tags. Report = actionable list, no fake scores.
- llms.txt (AI crawlers file) — 2026 standard, cheap to add, genuinely useful.

## 4. Users section (data + full control)

User's ask: registered users' numbers + data not showing; admin can do ANYTHING.
- List: name, email, joined date, last active, role — with search + filter.
- Actions per user: view details, edit, suspend/unsuspend, delete, password reset, role change (admin/user). Every button must execute for real (user's "koi nakli button nahi" rule).
- Root-cause check first: if Supabase RLS blocks admin reads, fix the policy; don't paper over it.
- Dashboard stats (live visitors, users, tools) become BUTTONS → each opens its detail page (user's exact ask).
- Live visitors counter fix: presence via periodic heartbeat writes with expiry (e.g. 60s window); the "stuck" value suggests the cleanup/expiry query is broken.

## 5. Dashboard (Shopify/Ghost-style overview)

- Live stats row: visitors online, total users, tools used today — each a button to detail pages.
- Activity log: what admin changed, when (WordPress/Ghost standard).
- System health panel: website, APIs, DB status — one-line live statuses.
- Global admin search: tools, blog posts, users, ads.

## Done-definition (user's rules)

1. Every button/action verified working on the LIVE site (website + app view + PC view).
2. Save → instantly live, no rebuild, no update popup.
3. Zero "failed"/error/red-cross states anywhere; unworkable features removed.
4. Report to user only after live verification, with visual proof (user's standing rule).
