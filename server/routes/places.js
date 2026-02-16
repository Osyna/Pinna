import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'

const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many import requests, please try again later' },
})

export default function placesRoutes(prisma) {
  const router = Router()
  router.use(authenticate)

  router.get('/', async (req, res) => {
    try {
      const places = await prisma.place.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
      })
      res.json({ places })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch places' })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const { name, lat, lng, address, category, notes, rating, cuisine, tags, website } = req.body

      if (!name || lat == null || lng == null) {
        return res.status(400).json({ error: 'Name, lat, lng are required' })
      }
      if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid coordinates' })
      }

      const place = await prisma.place.create({
        data: {
          name: String(name).slice(0, 255),
          lat,
          lng,
          address: String(address || '').slice(0, 500),
          category: String(category || 'other').slice(0, 50),
          notes: String(notes || '').slice(0, 2000),
          rating: Math.max(0, Math.min(5, Number(rating) || 0)),
          cuisine: String(cuisine || 'None').slice(0, 100),
          tags: Array.isArray(tags) ? tags.slice(0, 20).map(t => String(t).slice(0, 100)) : [],
          website: String(website || '').slice(0, 500),
          userId: req.userId,
        },
      })
      res.status(201).json({ place })
    } catch (err) {
      res.status(500).json({ error: 'Failed to create place' })
    }
  })

  router.post('/import', importLimiter, async (req, res) => {
    try {
      const { places: incoming } = req.body
      if (!Array.isArray(incoming) || incoming.length === 0) {
        return res.status(400).json({ error: 'places array is required' })
      }
      if (incoming.length > 500) {
        return res.status(400).json({ error: 'Maximum 500 places per import' })
      }

      for (const p of incoming) {
        if (typeof p.lat !== 'number' || typeof p.lng !== 'number') {
          return res.status(400).json({ error: 'Each place must have numeric lat and lng' })
        }
        if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
          return res.status(400).json({ error: 'lat must be -90..90 and lng must be -180..180' })
        }
      }

      const created = await prisma.place.createMany({
        data: incoming.map(p => ({
          name: String(p.name || 'Unknown').slice(0, 255),
          lat: p.lat,
          lng: p.lng,
          address: String(p.address || '').slice(0, 500),
          category: String(p.category || 'other').slice(0, 50),
          notes: String(p.notes || '').slice(0, 2000),
          rating: Math.max(0, Math.min(5, Number(p.rating) || 0)),
          cuisine: String(p.cuisine || 'None').slice(0, 100),
          tags: Array.isArray(p.tags) ? p.tags.slice(0, 20).map(t => String(t).slice(0, 100)) : [],
          userId: req.userId,
        })),
      })

      const places = await prisma.place.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: created.count,
      })

      res.status(201).json({ count: created.count, places })
    } catch (err) {
      console.error('Import error:', err)
      res.status(500).json({ error: 'Failed to import places' })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      const existing = await prisma.place.findFirst({
        where: { id: req.params.id, userId: req.userId },
      })
      if (!existing) {
        return res.status(404).json({ error: 'Place not found' })
      }

      const { name, lat, lng, address, category, notes, rating, cuisine, tags, website } = req.body
      const place = await prisma.place.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(lat !== undefined && { lat }),
          ...(lng !== undefined && { lng }),
          ...(address !== undefined && { address }),
          ...(category !== undefined && { category }),
          ...(notes !== undefined && { notes }),
          ...(rating !== undefined && { rating }),
          ...(cuisine !== undefined && { cuisine }),
          ...(tags !== undefined && { tags }),
          ...(website !== undefined && { website }),
        },
      })
      res.json({ place })
    } catch (err) {
      res.status(500).json({ error: 'Failed to update place' })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const existing = await prisma.place.findFirst({
        where: { id: req.params.id, userId: req.userId },
      })
      if (!existing) {
        return res.status(404).json({ error: 'Place not found' })
      }

      await prisma.place.delete({ where: { id: req.params.id } })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete place' })
    }
  })

  return router
}
