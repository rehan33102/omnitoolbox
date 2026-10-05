# App Audit — PC (Electron) & Android (WebView) — 2026-10-05

Audited by: Meta dev team (subagent). **Audit only — no fixes applied.**
Sources: `~/workspace/omnitoolbox-desktop/main.js`, `electron-builder.yml`,
`~/workspace/apk-build/webview/.../MainActivity.java` (+ `webview-admin` variant),
`AndroidManifest.xml`, `~/workspace/samples/omnitoolbox-app-v9.apk`
(aapt: `versionCode=9`, `com.omnitoolbox.app`, perms: INTERNET + ACCESS_NETWORK_STATE only),
GitHub release `v1.0.0-pc` (OmniToolBox-PC-Portable.zip).

Architecture summary: both apps are thin wrappers around the live site
`https://omnitoolbox-zeta.vercel.app/`. Web fixes propagate automatically;
native-shell bugs do not.

---

## ANDROID APP (OmniBox v9, `com.omnitoolbox.app`)

### 🔴 CRITICAL

**A1. No `DownloadListener` — every download silently fails in the app.**
- Root cause: `MainActivity.configureWebView()` never calls
  `webView.setDownloadListener(...)`. Android WebView does not handle
  downloads natively; without a listener, a programmatic `a[download]` click
  (the site's `lib/download.ts` blob-URL flow) is swallowed with zero UI
  feedback.
- This is exactly the user report: *"download button dabaya, kuch bhi show
  nahi hua"* — while the same buttons work in desktop Chrome (verified).
- Extra wrinkle: the site downloads via `blob:` URLs. Even with a plain
  `DownloadListener`, `DownloadManager` cannot fetch `blob:` URLs (in-memory
  only). The robust fix is a JS bridge: convert blob → base64 in-page, pass
  to native, write to `Downloads/` via MediaStore.
- Proposed fix: add `setDownloadListener` + `@JavascriptInterface`
  `saveBase64(filename, base64)` writing via MediaStore
  (`RELATIVE_PATH=Download/OmniBox`); add site-side fallback that detects
  the app UA (`OmniBox-App`) and routes downloads through the bridge.
  Request `WRITE_EXTERNAL_STORAGE` (API ≤28) in manifest.

**A2. `WebStorage.deleteAllData()` on every startup wipes the Local Library.**
- Root cause: `onCreate()` calls
  `android.webkit.WebStorage.getInstance().deleteAllData()` on every launch
  (comment says "v7: fix old content showing"). This deletes **all**
  localStorage **and all IndexedDB databases** — including the site's Local
  Library (`@/lib/db` → IndexedDB blobs). Every app start = user's saved
  library silently erased. Also wipes any auth/session state.
- Proposed fix: remove the call entirely. Stale-content concern is already
  handled by the service worker (`skipWaiting` + `clientsClaim`, network-first
  navigations) and the new `AutoUpdater` component. If a one-time migration
  clear is ever needed, gate it behind a `SharedPreferences` "cleared_vX"
  flag so it runs once, not every launch.

### 🟠 HIGH

**A3. Hardcoded `CURRENT_VERSION_CODE = 6` vs built versionCode 9 → permanent false "Update available" nag.**
- Root cause: the Java constant was never bumped; build script
  (`build-webview-apk-v9.sh`) passes `--version-code 9` at link time, but
  `checkForUpdate()` compares server `versionCode: 9 > 6` → shows the update
  dialog on **every** launch even when already on v9.
- Proposed fix: read the real version via
  `getPackageManager().getPackageInfo(getPackageName(), 0).versionCode`
  instead of a hardcoded constant.

**A4. `webView.clearCache(true)` on every startup.**
- Root cause: same "v7" block as A2. Clears the HTTP cache each launch, so
  tutorial MP4s, tool images, and `_next/static` assets re-download **every
  time the app opens** — this is the user's *"tutorial video har baar
  download hoti hai"* complaint, plus slow cold starts and wasted mobile data.
- Proposed fix: remove; rely on service worker + HTTP cache headers
  (`vercel.json` already sets immutable 1-year caching for `/tutorials/*`
  and `/images/*`).

**A5 (admin app). `VERSION_URL` typo: `.../adminapi/app-version` (missing slash).**
- Root cause: `webview-admin/.../MainActivity.java` line 42 points at a
  nonexistent path → 404 → silently swallowed by try/catch. The admin app
  will **never** notify about updates.
- Proposed fix: correct to `/api/app-version` (or a dedicated admin version
  endpoint).

**A6 (admin app). Loads `/admin` with no auth — hits the login gate.**
- Root cause: fresh WebView has no cookies; the `boss_key` bypass cookie is
  only set via the secret-link redirect flow, which the app never performs.
  Middleware redirects `/admin` → `/login`, and `shouldOverrideUrlLoading`
  keeps it in-app → admin app is unusable out of the box.
- Proposed fix: on first launch, load the one-time secret-link URL
  (`/admin?boss=...` — token must move out of git history into a
  build-time secret), let middleware set the cookie via redirect, then all
  subsequent `/admin` loads work. (Long-term: replace token bypass with a
  proper device-bound session.)

### 🟡 MEDIUM

**A7. No fullscreen video support** (`onShowCustomView`/`onHideCustomView` not
overridden in `WebChromeClient`). Tutorial fullscreen button degrades to the
site's CSS fake-fullscreen (works, but not true fullscreen).
Proposed fix: implement the standard custom-view fullscreen pattern.

**A8. No `REQUEST_INSTALL_PACKAGES` permission.** The "Update Now" button
fires an `ACTION_VIEW` intent on the APK URL; on Android 8+ the system/browser
needs install-unknown-apps approval and the flow is fragile.
Proposed fix: add permission + use `FileProvider` + `ACTION_INSTALL_PACKAGE`
for in-app update install, or route through the browser with a clear prompt.

**A9. File chooser has no camera capture.** `onShowFileChooser` is present
(image upload works), but no `EXTRA_ALLOW_MULTIPLE` / camera intent, so
"take photo" is unavailable in BG tools.
Proposed fix: add `MediaStore.ACTION_IMAGE_CAPTURE` chooser option.

**A10. `shouldOverrideUrlLoading` host check uses `endsWith`.**
`evil-omnitoolbox-zeta.vercel.app` would stay in-app. Low risk, but tighten to
exact-host match.
Proposed fix: `host.equals("omnitoolbox-zeta.vercel.app")`.

### Notes (working as intended)
- File upload (`onShowFileChooser`) ✅, back-button WebView history ✅,
  splash fade ✅, external links → browser ✅, WebView-crash fallback screen ✅.

---

## PC APP (Electron, `OmniToolBox-PC-Portable.zip`, release `v1.0.0-pc`)

`main.js` is a minimal `BrowserWindow` (1280×800) loading the live site.
`contextIsolation: true`, `nodeIntegration: false` — sane defaults.

### 🟠 HIGH
**P1. No self-updater.** `electron-updater` is not configured; the wrapper
binary never updates itself. (Web content updates automatically since it loads
the live site — that part is fine — but any native-shell fix requires the user
to manually re-download the ZIP from GitHub.)
Proposed fix: add `electron-updater` + `publish` config in
`electron-builder.yml` pointing at the GitHub release, call
`autoUpdater.checkForUpdatesAndNotify()` on `app.whenReady()`.

### 🟡 MEDIUM
**P2. Unsigned executable** (`signAndEditExecutable: false`, no cert).
Windows SmartScreen shows "Unknown publisher" warning on first run; some
users will abandon the install.
Proposed fix: sign with a code-signing cert (paid), or at minimum document
the SmartScreen bypass; alternatively ship via Microsoft Store later.

**P3. No single-instance lock.** Double-clicking the EXE twice opens two
windows/instances.
Proposed fix: `app.requestSingleInstanceLock()` + focus existing window on
second instance.

**P4. No download UX.** No `will-download` handler — downloads work (Chromium
saves to the default Downloads folder) but there is no save dialog, no
progress, no "reveal in folder".
Proposed fix: `session.on('will-download')` → `dialog.showSaveDialog` +
progress in the taskbar/window title.

### 🟢 LOW
**P5.** No crash reporter; **P6.** `win-unpacked` also builds an NSIS target
per yml but the published asset is the portable ZIP — harmless inconsistency,
but the yml/package.json `nsis` block is dead config for the shipped artifact;
**P7.** no protocol/deep-link handling (not needed today).

### Notes (working as intended)
- Live-site loading ✅ (web updates instant), external links → OS browser ✅,
  menu bar hidden ✅.

---

## Fix priority (recommended build order)
1. A1 (downloads) + A2 (library wipe) — both are user-visible data-loss-class bugs.
2. A4 (cache wipe) — same startup block, one edit.
3. A3 (version nag) + A5/A6 (admin app auth/update URL).
4. A7–A10, P1–P4 in the next release.

Rebuild artifacts after fixes: `build-webview-apk-v9.sh` → v10 APK (+ admin),
`electron-builder --win` → new portable ZIP + GitHub release; bump
`/api/app-version` (`versionCode`/`apkUrl`) so in-app updater picks it up.
