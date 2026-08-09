import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'

export default function listsRoutes(prisma) {
  const router = Router()
  router.use(authenticate)

  // All lists with their place ids
  router.get('/', async (req, res) => {
    try {
      const lists = await prisma.list.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'asc' },
        include: { places: { select: { placeId: true } } },
      })
      res.json({
        lists: lists.map(l => ({
          id: l.id, name: l.name, createdAt: l.createdAt,
          placeIds: l.places.map(p => p.placeId),
        })),
      })
    } catch {
      res.status(500).json({ error: 'Failed to fetch lists' })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim().slice(0, 60)
      if (!name) return res.status(400).json({ error: 'Name is required' })
      const list = await prisma.list.create({ data: { name, userId: req.userId } })
      res.status(201).json({ list: { id: list.id, name: list.name, createdAt: list.createdAt, placeIds: [] } })
    } catch {
      res.status(500).json({ error: 'Failed to create list' })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim().slice(0, 60)
      if (!name) return res.status(400).json({ error: 'Name is required' })
      const existing = await prisma.list.findFirst({ where: { id: req.params.id, userId: req.userId } })
      if (!existing) return res.status(404).json({ error: 'List not found' })
      await prisma.list.update({ where: { id: req.params.id }, data: { name } })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to rename list' })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const existing = await prisma.list.findFirst({ where: { id: req.params.id, userId: req.userId } })
      if (!existing) return res.status(404).json({ error: 'List not found' })
      await prisma.list.delete({ where: { id: req.params.id } })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to delete list' })
    }
  })

  // Membership
  router.post('/:id/places', async (req, res) => {
    try {
      const { placeId } = req.body || {}
      const [list, place] = await Promise.all([
        prisma.list.findFirst({ where: { id: req.params.id, userId: req.userId } }),
        prisma.place.findFirst({ where: { id: placeId, userId: req.userId } }),
      ])
      if (!list || !place) return res.status(404).json({ error: 'Not found' })
      await prisma.listPlace.upsert({
        where: { listId_placeId: { listId: list.id, placeId } },
        create: { listId: list.id, placeId },
        update: {},
      })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to add to list' })
    }
  })

  router.delete('/:id/places/:placeId', async (req, res) => {
    try {
      const list = await prisma.list.findFirst({ where: { id: req.params.id, userId: req.userId } })
      if (!list) return res.status(404).json({ error: 'List not found' })
      await prisma.listPlace.deleteMany({ where: { listId: list.id, placeId: req.params.placeId } })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to remove from list' })
    }
  })

  return router
}
