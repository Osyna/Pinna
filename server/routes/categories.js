import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'

export default function categoriesRoutes(prisma) {
  const router = Router()
  router.use(authenticate)

  router.get('/', async (req, res) => {
    try {
      const categories = await prisma.category.findMany({
        where: { userId: req.userId },
      })
      res.json({ categories })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch categories' })
    }
  })

  router.put('/', async (req, res) => {
    try {
      const { categories } = req.body
      if (!Array.isArray(categories)) {
        return res.status(400).json({ error: 'Categories array required' })
      }
      if (categories.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 categories' })
      }

      const validColor = /^#[0-9a-fA-F]{6}$/
      for (const c of categories) {
        if (!c.name || typeof c.name !== 'string') {
          return res.status(400).json({ error: 'Each category must have a name' })
        }
        if (c.color && !validColor.test(c.color)) {
          return res.status(400).json({ error: 'Invalid color format, use #RRGGBB' })
        }
      }

      await prisma.category.deleteMany({ where: { userId: req.userId } })
      await prisma.category.createMany({
        data: categories.map(c => ({
          name: String(c.name).slice(0, 100),
          color: c.color || '#808080',
          icon: String(c.icon || 'bookmark').slice(0, 50),
          userId: req.userId,
        })),
      })
      const result = await prisma.category.findMany({
        where: { userId: req.userId },
      })
      res.json({ categories: result })
    } catch (err) {
      res.status(500).json({ error: 'Failed to update categories' })
    }
  })

  return router
}
