# Pinna — Scaling & Reliability Plan

Goal: a strong, reliable app that scales **without being restricted** by
third-party rate limits. Status legend: ✅ done · 🔜 next · 🎯 later.

## 1 · Geo services (the external bottleneck)

| Service | Today | Next steps |
|---|---|---|
| Nominatim (search) | ✅ auth-gated proxy, per-user rate limit, L1 memory + **L2 Postgres cache (survives restarts, shared by replicas)** | 🔜 request queue (1 rps global toward upstream, jittered retry on 429) · 🎯 self-host **Photon** (typo-tolerant, no limits) |
| Overpass (nearby) | ✅ proxied · ✅ **grid-quantized shared cell cache** (`/api/geo/nearby`): pans/users reuse cells, repeat views are 100% cache · ✅ stale-while-revalidate freshness (fresh <24 h, stale served instantly + background refetch, hard expiry 14 d → closed/new places appear within a day of anyone viewing the area) · ✅ mirror rotation to overpass.kumi.systems on 429/5xx/timeouts | 🎯 pre-warm cells around users' saved areas |
| OSRM (routing) | ✅ proxied + cached (1 h TTL) | 🎯 self-host `osrm-backend` with a regional extract (or Valhalla) on the Dokploy box |
| Basemap tiles | client → CARTO/OSM/Esri, SW-cached on device (7 d, 2000 tiles) | 🎯 **Protomaps PMTiles**: one static file self-hosted behind the CDN = zero tile rate limits, offline-friendly, custom cartoon style |

**L2 geo cache** (implemented): `GeoCache` table, read-through
memory → Postgres → upstream, promote-on-hit, opportunistic pruning,
`X-Geo-Cache: hit | hit-db | miss` for observability.

## 2 · HTTP & delivery

- 🔜 **Cloudflare (free) in front of maps.osyna.sh** — static assets cached at the edge,
  DDoS shield, brotli, HTTP/3. Bypass cache for `/api/*` except `/api/geo/*` GETs
  (safe to edge-cache ~10 min with the auth header stripped via a worker, or leave to the app proxy).
- 🔜 nginx `proxy_cache` for `/api/geo` GETs (micro-cache 60 s) — absorbs bursts before Node.
- ✅ immutable hashed assets (1 y), gzip; fonts self-hosted.

## 3 · Database

- ✅ indexes on hot paths; migrations with committed history; daily off-site dumps.
- 🔜 `updatedAt` on Place → strong ETag/304 for `GET /places` (most boots transfer 0 bytes).
- 🔜 pagination / `since=` delta sync once accounts exceed ~2k places.
- 🎯 **pgBackRest or WAL-G → S3** for point-in-time recovery (the incident-proof upgrade).
- 🎯 PgBouncer when API replicas > 1.

## 4 · App runtime

- ✅ stateless JWT API → horizontal scaling is just replicas behind Traefik/Dokploy.
- 🔜 move the geo L1 cache sizing + rate limiter to per-instance config; L2 already shared.
- 🎯 Redis only if/when: pub/sub for live features, shared rate limiting across replicas.

## 5 · Client resilience

- ✅ SW: tiles + API reads cached → offline read mode; app-shell stale-while-revalidate.
- 🔜 `api.js`: exponential backoff + jitter on 429/5xx (single retry for GETs), single-flight
  de-dupe for identical in-flight GETs.
- 🔜 IndexedDB hydration of the places store → instant boot, then revalidate.
- 🎯 Background Sync queue for offline writes (save place offline → syncs later).

## 6 · Observability & guardrails

- ✅ pino JSON logs with redaction; central error handler; CI (tests + build) blocking merge.
- 🔜 uptime monitoring (Uptime Kuma on Dokploy) + alert on `/api/geo` 502 rate.
- 🔜 Sentry (or GlitchTip self-hosted) for client + server exceptions.
- 🎯 Grafana/Loki for log search once volume justifies it.

## Suggested order

1. Cloudflare in front (30 min, biggest resilience/€0)
2. Overpass bbox quantization + mirror fallback (kills the flakiest UX path)
3. `updatedAt` + ETag on /places (cheap bandwidth win)
4. WAL-G PITR backups to S3 (upgrade from daily dumps)
5. PMTiles self-hosted basemap (the "never rate-limited again" endgame)
