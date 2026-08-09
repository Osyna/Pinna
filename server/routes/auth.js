import { Router } from 'express'
import express from 'express'
import bcrypt from 'bcryptjs'
import sharp from 'sharp'
import rateLimit from 'express-rate-limit'
import { generateToken, generateRefreshToken, verifyToken, authenticate } from '../middleware/auth.js'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
})

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const USER_SELECT = {
  id: true, email: true, name: true, handle: true, bio: true,
  country: true, favoriteCuisines: true, favoritePlaceIds: true, theme: true, skin: true, createdAt: true,
}

function generateHandle(name, email) {
  const base = (name || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14)
  return base + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

function validateHandle(h) {
  return /^[a-z0-9_]{3,20}$/.test(h)
}

export default function authRoutes(prisma) {
  const router = Router()
  console.log('Auth routes initialized')

  router.post('/register', authLimiter, async (req, res) => {
    try {
      const { email, password, name, handle } = req.body
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' })
      }
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' })
      }

      let finalHandle = handle
      if (finalHandle) {
        if (!validateHandle(finalHandle)) {
          return res.status(400).json({ error: 'User ID must be 3-20 chars: lowercase letters, numbers, underscores' })
        }
        const taken = await prisma.user.findUnique({ where: { handle: finalHandle } })
        if (taken) {
          return res.status(409).json({ error: 'User ID already taken' })
        }
      } else {
        finalHandle = generateHandle(name, email)
        // Ensure generated handle is unique
        while (await prisma.user.findUnique({ where: { handle: finalHandle } })) {
          finalHandle = generateHandle(name, email)
        }
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { email, password: hashed, name: name || null, handle: finalHandle },
        select: USER_SELECT,
      })
      const token = generateToken(user.id)
      const refreshToken = generateRefreshToken(user.id)
      res.status(201).json({ token, refreshToken, user })
    } catch (err) {
      console.error('Registration error:', err)
      res.status(500).json({ error: 'Registration failed' })
    }
  })

  router.post('/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }
      const token = generateToken(user.id)
      const refreshToken = generateRefreshToken(user.id)
      const safe = await prisma.user.findUnique({
        where: { id: user.id },
        select: USER_SELECT,
      })
      res.json({ token, refreshToken, user: safe })
    } catch (err) {
      console.error('Login error:', err)
      res.status(500).json({ error: 'Login failed' })
    }
  })

  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: USER_SELECT,
      })
      if (!user) return res.status(404).json({ error: 'User not found' })
      res.json({ user })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' })
    }
  })

  router.put('/profile', writeLimiter, authenticate, async (req, res) => {
    try {
      const { name, bio, country, favoriteCuisines, favoritePlaceIds, currentPassword, newPassword, handle, theme, skin } = req.body
      const updates = {}

      if (name !== undefined) updates.name = name
      if (bio !== undefined) updates.bio = bio
      if (country !== undefined) updates.country = country
      if (favoriteCuisines !== undefined) updates.favoriteCuisines = favoriteCuisines
      if (favoritePlaceIds !== undefined) updates.favoritePlaceIds = favoritePlaceIds
      if (theme === 'dark' || theme === 'light') updates.theme = theme
      if (skin === 'classic' || skin === 'cartoon') updates.skin = skin

      if (handle !== undefined) {
        if (!validateHandle(handle)) {
          return res.status(400).json({ error: 'User ID must be 3-20 chars: lowercase letters, numbers, underscores' })
        }
        const taken = await prisma.user.findFirst({ where: { handle, id: { not: req.userId } } })
        if (taken) {
          return res.status(409).json({ error: 'User ID already taken' })
        }
        updates.handle = handle
      }

      if (newPassword) {
        if (newPassword.length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' })
        }
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required' })
        }
        const existing = await prisma.user.findUnique({ where: { id: req.userId } })
        const valid = await bcrypt.compare(currentPassword, existing.password)
        if (!valid) {
          return res.status(401).json({ error: 'Current password is incorrect' })
        }
        updates.password = await bcrypt.hash(newPassword, 10)
      }

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: updates,
        select: USER_SELECT,
      })
      res.json({ user })
    } catch (err) {
      console.error('Profile update error:', err)
      res.status(500).json({ error: 'Failed to update profile' })
    }
  })

  router.get('/handle/check', authLimiter, async (req, res) => {
    try {
      const { handle } = req.query
      if (!handle || !validateHandle(handle)) {
        return res.json({ available: false })
      }
      const existing = await prisma.user.findUnique({ where: { handle } })
      res.json({ available: !existing })
    } catch {
      res.status(500).json({ error: 'Check failed' })
    }
  })

  router.get('/handle/suggest', async (req, res) => {
    try {
      const { name } = req.query
      const suggestions = []
      for (let i = 0; i < 10 && suggestions.length < 3; i++) {
        const h = generateHandle(name || '', 'user')
        const taken = await prisma.user.findUnique({ where: { handle: h } })
        if (!taken) suggestions.push(h)
      }
      res.json({ suggestions })
    } catch {
      res.status(500).json({ error: 'Suggest failed' })
    }
  })

  // Upload avatar (base64 in JSON body)
  router.post('/avatar', writeLimiter, express.json({ limit: '10mb' }), authenticate, async (req, res) => {
    try {
      const { image } = req.body
      if (!image) return res.status(400).json({ error: 'No image provided' })

      // Decode base64 (strip data URL prefix if present)
      const base64 = image.includes(',') ? image.split(',')[1] : image
      const inputBuffer = Buffer.from(base64, 'base64')

      // Process: center-crop to square, resize to 150x150, JPEG quality 85
      const processed = await sharp(inputBuffer)
        .resize(150, 150, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 85 })
        .toBuffer()

      await prisma.user.update({
        where: { id: req.userId },
        data: { avatarData: processed, avatarMime: 'image/jpeg' },
      })

      res.json({ success: true })
    } catch (err) {
      console.error('Avatar upload error:', err)
      res.status(500).json({ error: 'Failed to upload avatar' })
    }
  })

  // Serve avatar (public — no auth required)
  router.get('/avatar/:userId', async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.userId },
        select: { avatarData: true, avatarMime: true },
      })
      if (!user || !user.avatarData) {
        return res.status(404).json({ error: 'No avatar' })
      }
      res.set('Content-Type', user.avatarMime || 'image/jpeg')
      res.set('Cache-Control', 'public, max-age=3600')
      res.send(user.avatarData)
    } catch {
      res.status(500).json({ error: 'Failed to fetch avatar' })
    }
  })

  // Refresh access token using refresh token
  router.post('/refresh', authLimiter, async (req, res) => {
    try {
      const { refreshToken } = req.body
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' })
      }
      const payload = verifyToken(refreshToken)
      if (payload.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid refresh token' })
      }
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: USER_SELECT,
      })
      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }
      const token = generateToken(user.id)
      res.json({ token })
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' })
    }
  })

  // Delete avatar
  router.delete('/avatar', authenticate, async (req, res) => {
    try {
      await prisma.user.update({
        where: { id: req.userId },
        data: { avatarData: null, avatarMime: null },
      })
      res.json({ success: true })
    } catch {
      res.status(500).json({ error: 'Failed to delete avatar' })
    }
  })

  return router
}
