import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { pino } from 'pino'
import { pinoHttp } from 'pino-http'
import { PrismaClient } from '@prisma/client'
import authRoutes from './routes/auth.js'
import placesRoutes from './routes/places.js'
import categoriesRoutes from './routes/categories.js'
import previewRoutes from './routes/preview.js'
import friendsRoutes from './routes/friends.js'
import geoRoutes from './routes/geo.js'

const prisma = new PrismaClient()
const app = express()
const PORT = process.env.PORT || 3001

// Behind a reverse proxy (Nginx) in production, so trust the first hop.
// This lets express-rate-limit read the real client IP from X-Forwarded-For
// without allowing clients to spoof it.
app.set('trust proxy', 1)

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url.startsWith('/api/auth/avatar') },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
}))

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
app.use('/api/geo', geoRoutes())

// Central error handler: log with stack, answer with a safe message
app.use((err, req, res, _next) => {
  (req.log || logger).error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
