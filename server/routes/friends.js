import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

const FRIEND_SELECT = {
  id: true, name: true, handle: true,
  bio: true, country: true, favoriteCuisines: true,
  _count: { select: { places: true } },
}

export default function friendsRoutes(prisma) {
  const router = Router()
  router.use(authenticate)

  // List accepted friends
  router.get('/', async (req, res) => {
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ senderId: req.userId }, { receiverId: req.userId }],
        },
        include: {
          sender: { select: FRIEND_SELECT },
          receiver: { select: FRIEND_SELECT },
        },
      })
      const friends = friendships.map(f => {
        const other = f.senderId === req.userId ? f.receiver : f.sender
        return {
          id: other.id,
          name: other.name,
          handle: other.handle,
          bio: other.bio || '',
          country: other.country || '',
          favoriteCuisines: other.favoriteCuisines || [],
          placeCount: other._count.places,
          friendshipId: f.id,
        }
      })
      res.json({ friends })
    } catch {
      res.status(500).json({ error: 'Failed to fetch friends' })
    }
  })

  // Incoming pending requests
  router.get('/requests', async (req, res) => {
    try {
      const requests = await prisma.friendship.findMany({
        where: { receiverId: req.userId, status: 'pending' },
        include: { sender: { select: FRIEND_SELECT } },
        orderBy: { createdAt: 'desc' },
      })
      res.json({
        requests: requests.map(r => ({
          id: r.id,
          sender: {
            id: r.sender.id,
            name: r.sender.name,
            handle: r.sender.handle,
            placeCount: r.sender._count.places,
          },
          createdAt: r.createdAt,
        })),
      })
    } catch {
      res.status(500).json({ error: 'Failed to fetch requests' })
    }
  })

  // Outgoing pending requests
  router.get('/sent', async (req, res) => {
    try {
      const requests = await prisma.friendship.findMany({
        where: { senderId: req.userId, status: 'pending' },
        include: { receiver: { select: FRIEND_SELECT } },
        orderBy: { createdAt: 'desc' },
      })
      res.json({
        requests: requests.map(r => ({
          id: r.id,
          receiver: {
            id: r.receiver.id,
            name: r.receiver.name,
            handle: r.receiver.handle,
            placeCount: r.receiver._count.places,
          },
          createdAt: r.createdAt,
        })),
      })
    } catch {
      res.status(500).json({ error: 'Failed to fetch sent requests' })
    }
  })

  // Send friend request by handle
  router.post('/request', requestLimiter, async (req, res) => {
    try {
      const { handle } = req.body
      if (!handle) {
        return res.status(400).json({ error: 'Handle is required' })
      }
      const target = await prisma.user.findUnique({ where: { handle } })
      if (!target) {
        return res.status(404).json({ error: 'User not found' })
      }
      if (target.id === req.userId) {
        return res.status(400).json({ error: 'Cannot add yourself' })
      }

      // Check if friendship already exists in either direction
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: req.userId, receiverId: target.id },
            { senderId: target.id, receiverId: req.userId },
          ],
        },
      })
      if (existing) {
        if (existing.status === 'accepted') {
          return res.status(409).json({ error: 'Already friends' })
        }
        if (existing.status === 'pending') {
          return res.status(409).json({ error: 'Request already pending' })
        }
        // If rejected, allow re-requesting by deleting old record
        await prisma.friendship.delete({ where: { id: existing.id } })
      }

      const friendship = await prisma.friendship.create({
        data: { senderId: req.userId, receiverId: target.id },
      })
      res.status(201).json({ friendship })
    } catch {
      res.status(500).json({ error: 'Failed to send request' })
    }
  })

  // Accept request
  router.put('/requests/:id/accept', async (req, res) => {
    try {
      const friendship = await prisma.friendship.findUnique({
        where: { id: req.params.id },
      })
      if (!friendship || friendship.receiverId !== req.userId || friendship.status !== 'pending') {
        return res.status(404).json({ error: 'Request not found' })
      }
      const updated = await prisma.friendship.update({
        where: { id: req.params.id },
        data: { status: 'accepted' },
      })
      res.json({ friendship: updated })
    } catch {
      res.status(500).json({ error: 'Failed to accept request' })
    }
  })

  // Reject request
  router.put('/requests/:id/reject', async (req, res) => {
    try {
      const friendship = await prisma.friendship.findUnique({
        where: { id: req.params.id },
      })
      if (!friendship || friendship.receiverId !== req.userId || friendship.status !== 'pending') {
        return res.status(404).json({ error: 'Request not found' })
      }
      const updated = await prisma.friendship.update({
        where: { id: req.params.id },
        data: { status: 'rejected' },
      })
      res.json({ friendship: updated })
    } catch {
      res.status(500).json({ error: 'Failed to reject request' })
    }
  })

  // Unfriend
  router.delete('/:id', async (req, res) => {
    try {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { senderId: req.userId, receiverId: req.params.id },
            { senderId: req.params.id, receiverId: req.userId },
          ],
        },
      })
      if (!friendship) {
        return res.status(404).json({ error: 'Friendship not found' })
      }
      await prisma.friendship.delete({ where: { id: friendship.id } })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to remove friend' })
    }
  })

  // Find friends who saved a place at the same coordinates
  router.get('/place-matches', async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat)
      const lng = parseFloat(req.query.lng)
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'lat and lng are required' })
      }
      // Get accepted friend IDs
      const friendships = await prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ senderId: req.userId }, { receiverId: req.userId }],
        },
      })
      const friendIds = friendships.map(f => f.senderId === req.userId ? f.receiverId : f.senderId)
      if (friendIds.length === 0) return res.json({ friends: [] })

      // Find places at matching coords (within ~11m tolerance) from friends
      const tolerance = 0.0001
      const places = await prisma.place.findMany({
        where: {
          userId: { in: friendIds },
          lat: { gte: lat - tolerance, lte: lat + tolerance },
          lng: { gte: lng - tolerance, lte: lng + tolerance },
        },
        include: {
          user: { select: { id: true, name: true, handle: true } },
        },
      })
      // Deduplicate by user (a friend might have multiple places at same coords)
      const seen = new Set()
      const friends = []
      for (const p of places) {
        if (seen.has(p.userId)) continue
        seen.add(p.userId)
        friends.push({ id: p.user.id, name: p.user.name, handle: p.user.handle })
      }
      res.json({ friends })
    } catch {
      res.status(500).json({ error: 'Failed to find matching friends' })
    }
  })

  // Get friend's places
  router.get('/:friendId/places', async (req, res) => {
    try {
      // Verify accepted friendship
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { senderId: req.userId, receiverId: req.params.friendId },
            { senderId: req.params.friendId, receiverId: req.userId },
          ],
        },
      })
      if (!friendship) {
        return res.status(403).json({ error: 'Not friends' })
      }
      const places = await prisma.place.findMany({
        where: { userId: req.params.friendId },
        orderBy: { createdAt: 'desc' },
      })
      res.json({ places })
    } catch {
      res.status(500).json({ error: 'Failed to fetch friend places' })
    }
  })

  // Get friend's categories
  router.get('/:friendId/categories', async (req, res) => {
    try {
      const friendship = await prisma.friendship.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { senderId: req.userId, receiverId: req.params.friendId },
            { senderId: req.params.friendId, receiverId: req.userId },
          ],
        },
      })
      if (!friendship) {
        return res.status(403).json({ error: 'Not friends' })
      }
      const categories = await prisma.category.findMany({
        where: { userId: req.params.friendId },
      })
      res.json({ categories })
    } catch {
      res.status(500).json({ error: 'Failed to fetch friend categories' })
    }
  })

  return router
}
