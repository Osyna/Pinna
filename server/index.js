import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'
import authRoutes from './routes/auth.js'
import placesRoutes from './routes/places.js'
import categoriesRoutes from './routes/categories.js'
import previewRoutes from './routes/preview.js'
import friendsRoutes from './routes/friends.js'

const prisma = new PrismaClient()
const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by Nginx in production
}))
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '100kb' }))

app.use('/api/auth', authRoutes(prisma))
app.use('/api/places', placesRoutes(prisma))
app.use('/api/categories', categoriesRoutes(prisma))
app.use('/api/preview', previewRoutes())
app.use('/api/friends', friendsRoutes(prisma))

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
