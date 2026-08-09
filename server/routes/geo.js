import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'

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
const OVERPASS = 'https://overpass-api.de/api/interpreter'
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
    proxyJson(res, `overpass:${q}`, 10 * 60 * 1000, () =>
      fetch(OVERPASS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
      })
    )
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
