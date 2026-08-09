# Pinna — Improvement Plan (5 Tiers)

Grounded in a code audit (Feb 2026, PR #5 state). Measured facts:

| Metric | Value |
|---|---|
| JS bundle | **1.31 MB** (368 KB gzip), single chunk |
| CSS bundle | **240 KB** (~7 Ionic CSS files + legacy dark/light theme + cartoon skin) |
| Ionic usage | **one `<ion-app>` wrapper** — nothing else |
| DB indexes | none on `Place.userId` / `Place(userId, deletedAt)` / `Category.userId` |
| PWA | tile-caching SW exists, **no manifest.json** → not installable |
| Tests / CI | none |
| Geo providers | public nominatim / overpass-api.de / router.project-osrm.org, called from the client |
| Avatars | Postgres `Bytes`, served without cache headers |

---

## Tier 1 — Quick wins (≤ half a day each, do first)

1. **Drop Ionic** — replace `<ion-app>` with a `<div>`, remove the plugin + 7 CSS imports.
   Removes ~150 KB JS + ~100 KB CSS + the input-shims/keyboard/focus-visible side chunks. Zero UX change.
2. **DB indexes** — `@@index([userId])` on Place & Category, `@@index([userId, deletedAt])` on Place.
   Every request today walks the table; indexes make /places O(log n) as data grows.
3. **Code-split MapLibre** — `manualChunks: { maplibre: ['maplibre-gl'] }` (+ dynamic import of MapView).
   Auth screen / non-map tabs stop paying the ~800 KB map tax; better caching across deploys.
4. **PWA manifest** — `manifest.json` (name, icons, `display: standalone`, theme `#fff8ec`).
   The app is mobile-first and already has an SW — one file away from being installable.
5. **Undo in the delete toast** — soft-delete exists; add an "Undo" action to the toast (calls `restorePlace`).
   Cheaper than opening Recently Deleted; standard mobile UX.
6. **Avatar cache headers** — `Cache-Control: private, max-age=86400` + ETag on `/auth/avatar/:id` (client already busts with `avatarTs`).
7. **a11y pass on icon-only buttons** — `aria-label` for legend FAB, zoom, locate, hero edit/delete/close, tab buttons; `aria-pressed` on toggles. Screen-reader + Lighthouse win.

## Tier 2 — Performance & payload (1–3 days)

1. **Flatten the theme** — cartoon is the only theme; merge it into `main.scss`, delete the dead dark/light tokens, glass utilities and `[data-skin]` indirection.
   ~Halves the CSS, kills specificity hacks (`!important` layers), makes future styling 2× faster to write.
2. **Lazy-load heavy leaves** — `defineAsyncComponent` for AddPlaceModal, PlaceDetail edit mode, FriendProfileView, AuthModal; lazy `fuse.js` on first search.
3. **Offline reads** — SW route for `GET /api/places*` (network-first, cache fallback) + let the places store hydrate from cache when offline. The map already works offline via tile cache; this makes *your data* work too.
4. **Marker pipeline** — replace `watch(..., { deep: true })` with a store `version` counter bump on mutations; pre-generate marker images for the 13 default categories at map init (removes first-render pop-in).
5. **HTTP caching for GET /places** — `ETag` (hash of max(updatedAt)+count) → 304s for the common "nothing changed" boot.
6. **Font self-hosting** — bundle Baloo 2 + Nunito woff2 subsets instead of Google Fonts CSS (removes 3rd-party request chain, ~200 ms FCP on cold mobile).

## Tier 3 — Reliability & DX (2–5 days)

1. **Server-side geo proxy with cache** — `/api/geo/search|nearby|route` proxying Nominatim/Overpass/OSRM with an LRU + persistent cache and per-user rate limits.
   Fixes the #1 flakiness source (public endpoints throttle/fail), hides client IPs, lets you swap providers or add keys without an app release.
2. **Test harness + CI** — Vitest (stores, categoryIcons, server routes via supertest) + the Playwright smoke flows we already use ad hoc (login → save → delete → restore) checked into `e2e/`; GitHub Actions: build + unit + e2e on PR, blocking merge. Dokploy already auto-deploys `main` — CI closes the loop.
3. **Prisma migrations** — switch from `db push` at container boot to committed `prisma migrate` files run by the entrypoint. Reviewable schema history, no silent drift, safe rollbacks.
4. **Observability** — pino request logging (JSON) + Sentry (or GlitchTip) on both server and client; surface API error toasts consistently (several `catch {}` swallow errors today).
5. **Auth hardening** — refresh token rotation w/ reuse detection; move refresh token to httpOnly cookie; add `handle` uniqueness check race guard. Low urgency, high trust value.

## Tier 4 — Features (each ~1–3 days, ordered by value/effort)

1. **Overlapping-marker spiderfy** — at max zoom, same-spot places (bakery+hotel case) fan out on tap. Real usability bug today.
2. **Bulk organize** — long-press → multi-select in My Places: delete N, re-categorize N, tag N. Power users (541 places!) need this.
3. **Collections / trip lists** — named lists ("Madrid 2026") with places from any category, shareable with friends. Schema: `List`, `ListPlace`. This is the most-requested pattern in this app category.
4. **Place photos** — the OG-preview scraper (`/api/preview`) already fetches images for websites; persist the thumbnail URL on save + allow one user photo upload (reuse sharp avatar pipeline).
5. **Web push for friend requests** — SW is in place; add `web-push` + a `PushSubscription` table; notify on request/accept.
6. **Google Maps Takeout import** — parse saved-places JSON/CSV alongside the existing Mapstr importer; biggest onboarding unlock.
7. **i18n (EN/FR)** — user data is French, UI is English; `vue-i18n` with the ~120 strings extracted.

## Tier 5 — Big bets (1–3 weeks each)

1. **Shared/live maps** — WebSocket (or SSE) channel: live friend cursors, "X just saved a place", collaborative trip lists. Turns a utility into a social product.
2. **Public share pages** — `pinna.app/@handle/madrid` server-rendered OG pages (map snapshot + list) for links that unfurl nicely; the growth loop.
3. **Own geo stack** — Protomaps/PMTiles basemap on your CDN + self-hosted Photon (geocode) & OSRM/Valhalla (routing). Removes all public-endpoint dependencies, EU-data-clean, and *fast*; pairs with the Dokploy setup you already run.
4. **Native shells** — Capacitor wrap (iOS/Android) reusing the PWA; haptics composable already exists, map + camera plugins are the only native work.
5. **Smart features** — "near me now" push (geofenced saved places), auto-categorization of imports, duplicate detection/merge (same coords ±30 m), yearly "Places Wrapped".

---

### Suggested execution order

Tier 1 entirely (one afternoon, ships with the current PR train) → Tier 2.1 + 2.2 + 2.3 → Tier 3.1 + 3.2 (before any Tier 4/5 feature work, so features land on tested rails) → Tier 4 features by the order above.
