import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import { cellsForBbox, buildCellQuery, mergeElements } from '../lib/overpassGrid.js'

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
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const OVERPASS = OVERPASS_MIRRORS[0]
const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const UA = 'Pinna/1.0 (+https://maps.osyna.com)'

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

async function fetchOverpass(query) {
  let lastErr = null
  for (const base of OVERPASS_MIRRORS) {
    try {
      const resp = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(20000),
      })
      if (resp.status === 429 || resp.status >= 500) {
        lastErr = new Error(`upstream ${resp.status}`)
        continue // rotate to the next mirror
      }
      return resp
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('all overpass mirrors failed')
}

async function cellGet(key) {
  if (!prismaRef) return null
  try {
    const row = await prismaRef.geoCache.findUnique({ where: { key } })
    if (!row) return null
    const remaining = row.expiresAt.getTime() - Date.now()
    if (remaining <= 0) return null
    return {
      elements: JSON.parse(row.body),
      fresh: remaining > CELL_HARD_TTL - CELL_SOFT_TTL,
    }
  } catch { return null }
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

async function fetchCell(cell) {
  const resp = await fetchOverpass(buildCellQuery(cell.bbox))
  if (!resp.ok) throw new Error(`overpass ${resp.status}`)
  const data = await resp.json().catch(() => null)
  const elements = data?.elements || []
  cellPut(cell.key, elements)
  return elements
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

      for (const cell of cells) {
        const hit = await cellGet(cell.key)
        if (hit) {
          results.push(hit.elements)
          if (hit.fresh) freshN++
          else { staleN++; revalidateCell(cell) }
        } else {
          missing.push(cell)
        }
      }

      const fetched = await Promise.allSettled(missing.map(c => fetchCell(c)))
      for (const f of fetched) {
        missN++
        if (f.status === 'fulfilled') results.push(f.value)
      }

      res.set('X-Geo-Cells', `total=${cells.length} fresh=${freshN} stale=${staleN} miss=${missN}`)
      res.json({ elements: mergeElements(results) })
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
