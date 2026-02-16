import { Router } from 'express'
import ogs from 'open-graph-scraper'
import { authenticate } from '../middleware/auth.js'

const cache = new Map()
const TTL = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_SIZE = 1000

function isPrivateHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return true
  // IPv4 private ranges
  const parts = hostname.split('.')
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number)
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
  }
  return false
}

function trimCache() {
  if (cache.size <= MAX_CACHE_SIZE) return
  const entries = [...cache.entries()].sort((a, b) => a[1].expires - b[1].expires)
  const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE)
  for (const [key] of toRemove) cache.delete(key)
}

export default function previewRoutes() {
  const router = Router()

  router.get('/', authenticate, async (req, res) => {
    const { url } = req.query
    if (!url) {
      return res.status(400).json({ error: 'url query parameter is required' })
    }

    let parsed
    try {
      parsed = new URL(url)
    } catch {
      return res.status(400).json({ error: 'Invalid URL' })
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return res.status(400).json({ error: 'Only HTTP(S) URLs are allowed' })
    }
    if (isPrivateHost(parsed.hostname)) {
      return res.status(400).json({ error: 'URLs pointing to private/internal networks are not allowed' })
    }

    // Check cache
    const cached = cache.get(url)
    if (cached && Date.now() < cached.expires) {
      return res.json(cached.data)
    }

    try {
      const { result } = await ogs({ url, timeout: 5000 })
      const data = {
        image: result.ogImage?.[0]?.url || null,
        title: result.ogTitle || '',
        description: result.ogDescription || '',
      }

      cache.set(url, { data, expires: Date.now() + TTL })
      trimCache()
      res.json(data)
    } catch {
      const data = { image: null, title: '', description: '' }
      cache.set(url, { data, expires: Date.now() + TTL })
      trimCache()
      res.json(data)
    }
  })

  return router
}
