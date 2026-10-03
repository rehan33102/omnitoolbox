# OmniToolBox — All-in-One AI & Web Utility Platform

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + AdSense values
npx tsx scripts/seed.ts      # seed tools, directory, blog, ad placements
npm run dev                  # → http://localhost:3000
```

## Environment

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard | DB + auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | Server-only admin client |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | AdSense account | `ca-pub-XXXXXXXXXXXXXXXX` — enables ads site-wide |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Canonical URLs, sitemap, OG tags |

## Database

1. Create a Supabase project.
2. Run the SQL in `supabase/migrations/` (001→006) in the SQL editor.
3. Create the new-user trigger so every signup gets a profile row:
   ```sql
   create or replace function public.handle_new_user()
   returns trigger language plpgsql security definer as $$
   begin
     insert into public.profiles (id, email, role) values (new.id, new.email, 'user');
     return new;
   end $$;
   drop trigger if exists on_auth_user_created on auth.users;
   create trigger on_auth_user_created after insert on auth.users
   for each row execute function public.handle_new_user();
   ```
4. Make yourself admin: `update profiles set role='admin' where email='you@example.com';`
5. Seed: `npx tsx scripts/seed.ts`.

## Deploy (Vercel)

1. Push to GitHub → Import in Vercel.
2. Add all env vars above.
3. Deploy. CI runs lint + typecheck + build on every push (`.github/workflows/ci.yml`).

## Making money 💰

1. **AdSense**: apply at google.com/adsense with your deployed domain → get approved →
   set `NEXT_PUBLIC_ADSENSE_CLIENT_ID` → in `/admin` → Monetization, paste each
   ad unit's Slot ID into its placement → ads go live instantly, no redeploy.
2. **Affiliates**: edit any AI directory listing and set its affiliate URL —
   "Visit" buttons automatically use it with `rel="sponsored"`.
3. **Banners**: add banner image + link placements in Monetization for direct deals.

## Admin

- `/admin` — analytics, tools ON/OFF, ads, SEO (role-guarded via middleware + RLS).
- `/admin/seo` — one-click sitemap regenerate + Google/Bing ping.

## Performance

- All marketing pages are SSR with ISR (`revalidate`).
- Images: AVIF/WebP, lazy by default. Media tools are 100% client-side.
- Target: Lighthouse 95+ across Performance, Accessibility, SEO.
