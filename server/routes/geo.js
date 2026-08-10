import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import { cellsForBbox, buildCellQuery, mergeElements, refineToViewport } from '../lib/overpassGrid.js'

/**
 * Server-side proxy for the public geo services (Nominatim, Overpass, OSRM)
 * with an in-memory TTL cache.
 *
 * Why: public endpoints throttle per-IP and fail randomly for clients; the
 * proxy centralizes retries/caching, sends a proper User-Agent (Nominatim
 * usage policy), hides client IPs, and lets us swap providers or add API
 * keys without shipping a new frontend.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org'
// The two well-established, genuinely global public instances. A third
// candidate (overpass.osm.ch) was tested and dropped: it answers fast
// but turned out to be a *regional* Swiss mirror — 120 real elements
// for Zurich, 0 for Lyon/Paris/Berlin. A fast wrong answer (silently
// "no places found") is worse than a slow right one, so it's not
// worth the availability gain. fetchOverpass() below reorders these
// around whichever is currently healthy (see the circuit breaker).
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const UA = 'Pinna/1.0 (+https://maps.osyna.sh)'

const cache = new Map() // key -> { t, ttl, status, body }
const MAX_CACHE = 500

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.t > hit.ttl) { cache.delete(key); return null }
  // LRU refresh
  cache.delete(key)
  cache.set(key, hit)
  return hit
}

function cacheSet(key, ttl, status, body) {
  if (cache.size >= MAX_CACHE) {
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, { t: Date.now(), ttl, status, body })
}

let prismaRef = null

/* ── Overpass cell layer: shared grid cache + stale-while-revalidate ── */
const CELL_SOFT_TTL = 24 * 60 * 60 * 1000        // fresh: serve as-is
const CELL_HARD_TTL = 14 * 24 * 60 * 60 * 1000   // stale beyond this: blocking refetch
const cellRefreshing = new Set()

/* ── Tiny concurrency limiter ──────────────────────────────────────
 * Public Overpass instances allow only ~2 concurrent slots per IP;
 * since every user shares our server's IP, firing all of a request's
 * missing cells (or several requests' worth) at once is the single
 * fastest way to get 429'd. This caps *process-wide* outbound Overpass
 * concurrency instead of per-request, so bursts queue briefly rather
 * than triggering rate limits. */
function createLimiter(max) {
  let active = 0
  const queue = []
  const next = () => {
    if (active >= max || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    fn().then(resolve, reject).finally(() => { active--; next() })
  }
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next() })
}
const overpassLimiter = createLimiter(3)

/**
 * Hard ceiling on the "fetch missing cells" stage, independent of how
 * many mirrors are down or how slow they are. Whatever settles within
 * the deadline is returned; stragglers keep running in the background
 * (still writing to the cache for the next request) instead of holding
 * the HTTP response open. Guarantees /nearby always answers promptly
 * even during a full upstream outage — cache-hit cells still show
 * instantly, empty results beat a hung spinner.
 */
function settleWithDeadline(promises, ms) {
  return new Promise((resolve) => {
    const results = promises.map(() => ({ status: 'pending' }))
    let settledCount = 0
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(results.map((r) => (r.status === 'pending' ? { status: 'rejected', reason: new Error('deadline') } : r)))
    }
    const timer = setTimeout(finish, ms)
    promises.forEach((p, i) => {
      p.then(
        (value) => { results[i] = { status: 'fulfilled', value } },
        (reason) => { results[i] = { status: 'rejected', reason } },
      ).finally(() => {
        settledCount++
        if (settledCount === promises.length) finish()
      })
    })
    if (promises.length === 0) finish()
  })
}
let MISSING_CELLS_DEADLINE_MS = 14000

/** Test-only hook: swap in a tiny deadline so the mechanism can be
 * verified without a real multi-second sleep in the test suite. */
export function _setMissingCellsDeadlineForTests(ms) {
  MISSING_CELLS_DEADLINE_MS = ms
}

/* ── Per-mirror circuit breaker ─────────────────────────────────────
 * A mirror that just 429'd or timed out is far more likely to fail
 * again in the next few seconds than a mirror we haven't touched —
 * so skip it for a cooldown instead of re-eating its timeout on every
 * subsequent request. Recovers on its own once the cooldown elapses. */
const MIRROR_COOLDOWN_MS = 45 * 1000
const mirrorPenaltyUntil = new Map() // base url -> timestamp

function healthyMirrorOrder() {
  const now = Date.now()
  const healthy = []
  const penalized = []
  for (const base of OVERPASS_MIRRORS) {
    ;((mirrorPenaltyUntil.get(base) || 0) > now ? penalized : healthy).push(base)
  }
  // Shuffle the healthy pool so a burst of concurrent cell fetches (up to
  // overpassLimiter's concurrency) spreads its *first* attempt across
  // different mirrors instead of every one of them herding onto the same
  // "still looks fine to me" mirror before any single one has failed
  // fast enough to teach the circuit breaker. Penalized mirrors stay last
  // and in a fixed order — no point randomizing among known-bad options.
  for (let i = healthy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[healthy[i], healthy[j]] = [healthy[j], healthy[i]]
  }
  return [...healthy, ...penalized]
}

function penalizeMirror(base) {
  mirrorPenaltyUntil.set(base, Date.now() + MIRROR_COOLDOWN_MS)
}

async function fetchOverpass(query) {
  let lastErr = null
  for (const base of healthyMirrorOrder()) {
    try {
      const resp = await overpassLimiter(() => fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(6000),
      }))
      if (resp.status === 429 || resp.status >= 500) {
        penalizeMirror(base)
        lastErr = new Error(`upstream ${resp.status}`)
        continue // rotate to the next (healthy) mirror
      }
      return resp
    } catch (err) {
      penalizeMirror(base) // timeout / network error — likely to repeat, back off
      lastErr = err
    }
  }
  throw lastErr || new Error('all overpass mirrors failed')
}

/** Batched cache lookup — one round trip for every cell instead of one per cell. */
async function cellGetMany(keys) {
  const out = new Map()
  if (!prismaRef || keys.length === 0) return out
  try {
    const rows = await prismaRef.geoCache.findMany({ where: { key: { in: keys } } })
    const now = Date.now()
    for (const row of rows) {
      const remaining = row.expiresAt.getTime() - now
      if (remaining <= 0) continue
      out.set(row.key, {
        elements: JSON.parse(row.body),
        fresh: remaining > CELL_HARD_TTL - CELL_SOFT_TTL,
      })
    }
  } catch { /* cache miss on error is fine, upstream fetch covers it */ }
  return out
}

function cellPut(key, elements) {
  if (!prismaRef) return
  const data = {
    status: 200,
    body: JSON.stringify(elements),
    expiresAt: new Date(Date.now() + CELL_HARD_TTL),
  }
  prismaRef.geoCache.upsert({ where: { key }, create: { key, ...data }, update: data }).catch(() => {})
}

async function fetchCellRaw(cell) {
  const resp = await fetchOverpass(buildCellQuery(cell.bbox))
  if (!resp.ok) throw new Error(`overpass ${resp.status}`)
  const data = await resp.json().catch(() => null)
  const elements = data?.elements || []
  cellPut(cell.key, elements)
  return elements
}

/* In-flight de-dupe: several requests (different users, or a fast
 * double-click) hitting the same still-missing cell at once should
 * trigger exactly one upstream Overpass call, not one each. */
const cellInFlight = new Map() // key -> Promise<elements>

function fetchCell(cell) {
  const existing = cellInFlight.get(cell.key)
  if (existing) return existing
  const p = fetchCellRaw(cell).finally(() => cellInFlight.delete(cell.key))
  cellInFlight.set(cell.key, p)
  return p
}

function revalidateCell(cell) {
  if (cellRefreshing.has(cell.key)) return
  cellRefreshing.add(cell.key)
  fetchCell(cell)
    .catch(() => {})
    .finally(() => cellRefreshing.delete(cell.key))
}

async function l2Get(key) {
  if (!prismaRef) return null
  try {
    const row = await prismaRef.geoCache.findUnique({ where: { key } })
    if (!row) return null
    if (row.expiresAt < new Date()) {
      prismaRef.geoCache.delete({ where: { key } }).catch(() => {})
      return null
    }
    return { status: row.status, body: JSON.parse(row.body) }
  } catch { return null }
}

function l2Set(key, ttl, status, body) {
  if (!prismaRef) return
  const expiresAt = new Date(Date.now() + ttl)
  const data = { status, body: JSON.stringify(body), expiresAt }
  prismaRef.geoCache.upsert({ where: { key }, create: { key, ...data }, update: data }).catch(() => {})
  // opportunistic pruning (~1% of writes)
  if (Math.random() < 0.01) {
    prismaRef.geoCache.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})
  }
}

async function proxyJson(res, key, ttl, doFetch) {
  const hit = cacheGet(key)
  if (hit) {
    res.set('X-Geo-Cache', 'hit')
    return res.status(hit.status).json(hit.body)
  }
  const l2 = await l2Get(key)
  if (l2) {
    cacheSet(key, ttl, l2.status, l2.body) // promote to L1
    res.set('X-Geo-Cache', 'hit-db')
    return res.status(l2.status).json(l2.body)
  }
  try {
    const upstream = await doFetch()
    const body = await upstream.json().catch(() => null)
    if (body == null) {
      return res.status(502).json({ error: 'Bad upstream response' })
    }
    if (upstream.ok) {
      cacheSet(key, ttl, upstream.status, body)
      l2Set(key, ttl, upstream.status, body)
    }
    res.set('X-Geo-Cache', 'miss')
    res.status(upstream.status).json(body)
  } catch {
    // upstream down: serve stale L2 if any, else 502
    res.status(502).json({ error: 'Geo service unavailable' })
  }
}

export default function geoRoutes(prisma = null) {
  const router = Router()

  prismaRef = prisma

  const geoLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })

  router.use(authenticate)
  router.use(geoLimiter)

  // Nominatim passthrough: /api/geo/search?... and /api/geo/reverse?...
  for (const path of ['search', 'reverse']) {
    router.get(`/${path}`, (req, res) => {
      const qs = new URLSearchParams(req.query).toString()
      const url = `${NOMINATIM}/${path}?${qs}`
      proxyJson(res, url, 24 * 60 * 60 * 1000, () =>
        fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': req.headers['accept-language'] || 'en' } })
      )
    })
  }

  // Overpass: POST { data: '<overpass ql>' }
  router.post('/overpass', (req, res) => {
    const q = typeof req.body?.data === 'string' ? req.body.data : ''
    if (!q || q.length > 4000) {
      return res.status(400).json({ error: 'Invalid query' })
    }
    proxyJson(res, `overpass:${q}`, 10 * 60 * 1000, () => fetchOverpass(q))
  })

  // Nearby places by bbox — grid-quantized shared cache.
  // Cells fresh (<24h) are served as-is; stale cells are served
  // instantly and refreshed in the background (reality stays aligned:
  // closed/new places appear within a day of anyone viewing the area);
  // missing/expired cells are fetched now with mirror fallback.
  router.post('/nearby', async (req, res) => {
    const { south, west, north, east } = req.body || {}
    if (![south, west, north, east].every(v => typeof v === 'number' && Number.isFinite(v))) {
      return res.status(400).json({ error: 'Invalid bbox' })
    }
    if (north - south > 1 || east - west > 1 || north <= south || east <= west) {
      return res.status(400).json({ error: 'Bbox too large' })
    }
    try {
      const cells = cellsForBbox({ south, west, north, east })
      const results = []
      let freshN = 0, staleN = 0, missN = 0
      const missing = []

      // One batched lookup for every cell instead of one DB round trip each.
      const hits = await cellGetMany(cells.map((c) => c.key))
      for (const cell of cells) {
        const hit = hits.get(cell.key)
        if (hit) {
          results.push(hit.elements)
          if (hit.fresh) freshN++
          else { staleN++; revalidateCell(cell) }
        } else {
          missing.push(cell)
        }
      }

      // fetchCell() is both concurrency-limited (process-wide) and
      // in-flight-deduped, so this can safely fire all missing cells
      // at once — they'll queue behind the shared Overpass limiter
      // rather than bursting the upstream.
      const fetched = await settleWithDeadline(missing.map((c) => fetchCell(c)), MISSING_CELLS_DEADLINE_MS)
      for (const f of fetched) {
        missN++
        if (f.status === 'fulfilled') results.push(f.value)
      }

      // Cells always fully cover the bbox and can extend past it —
      // trim back to what was actually asked for, closest-first, so
      // truncation (if any) never drops the most relevant results.
      const elements = refineToViewport(mergeElements(results, 600), { south, west, north, east }, 200)

      res.set('X-Geo-Cells', `total=${cells.length} fresh=${freshN} stale=${staleN} miss=${missN}`)
      res.json({ elements })
    } catch {
      res.status(502).json({ error: 'Geo service unavailable' })
    }
  })

  // OSRM: /api/geo/route/lng,lat;lng,lat?overview=full...
  router.get('/route/:coords', (req, res) => {
    if (!/^[-\d.,;]+$/.test(req.params.coords)) {
      return res.status(400).json({ error: 'Invalid coordinates' })
    }
    const qs = new URLSearchParams(req.query).toString()
    const url = `${OSRM}/${req.params.coords}?${qs}`
    proxyJson(res, url, 60 * 60 * 1000, () => fetch(url, { headers: { 'User-Agent': UA } }))
  })

  return router
}
