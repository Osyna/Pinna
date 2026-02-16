# Account System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user accounts with email+password auth and PostgreSQL storage, replacing localStorage with per-user cloud sync.

**Architecture:** Express.js backend with Prisma ORM connected to external PostgreSQL via `DATABASE_URL` env var. JWT auth with bcrypt password hashing. Vite proxies `/api/*` to Express in dev. Frontend adds auth store, auth composable, and auth modal.

**Tech Stack:** Express.js, Prisma, bcrypt, jsonwebtoken, axios, Vue 3 + Pinia

---

### Task 1: Install backend dependencies and scaffold server

**Files:**
- Modify: `package.json`
- Create: `server/index.js`
- Create: `.env.example`
- Create: `.gitignore` entry

**Step 1: Install backend dependencies**

Run:
```bash
cd /home/irvin/Projects/Mappsly
npm install express @prisma/client bcryptjs jsonwebtoken cors
npm install -D prisma concurrently
```

**Step 2: Create `.env.example`**

Create file `.env.example`:
```
DATABASE_URL=postgresql://user:password@host:5432/mappsly
JWT_SECRET=change-me-to-a-random-secret
```

**Step 3: Add `.env` to `.gitignore`**

Append to `.gitignore` (create if doesn't exist):
```
.env
```

**Step 4: Create `server/index.js` with minimal Express server**

Create file `server/index.js`:
```javascript
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import authRoutes from './routes/auth.js'
import placesRoutes from './routes/places.js'
import categoriesRoutes from './routes/categories.js'

const prisma = new PrismaClient()
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes(prisma))
app.use('/api/places', placesRoutes(prisma))
app.use('/api/categories', categoriesRoutes(prisma))

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

**Step 5: Commit**

```bash
git add package.json package-lock.json server/index.js .env.example .gitignore
git commit -m "feat: scaffold Express backend with dependencies"
```

---

### Task 2: Set up Prisma schema and run migration

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Initialize Prisma**

Run:
```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and updates `.env`.

**Step 2: Write the Prisma schema**

Replace `prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id         String     @id @default(uuid())
  email      String     @unique
  password   String
  name       String?
  createdAt  DateTime   @default(now())
  places     Place[]
  categories Category[]
}

model Place {
  id        String   @id @default(uuid())
  name      String
  lat       Float
  lng       Float
  address   String   @default("")
  category  String   @default("other")
  notes     String   @default("")
  rating    Int      @default(0)
  cuisine   String   @default("None")
  tags      String[] @default([])
  createdAt DateTime @default(now())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Category {
  id     String @id @default(uuid())
  name   String
  color  String
  icon   String
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Step 3: Set up `.env` with your actual DATABASE_URL**

Create `.env`:
```
DATABASE_URL=postgresql://user:password@host:5432/mappsly
JWT_SECRET=some-random-secret-string-at-least-32-chars
```

**Step 4: Run migration**

Run:
```bash
npx prisma migrate dev --name init
```

Expected: Creates migration files, applies schema to database, generates Prisma client.

**Step 5: Commit**

```bash
git add prisma/ .env.example
git commit -m "feat: add Prisma schema with User, Place, Category models"
```

---

### Task 3: Create JWT auth middleware

**Files:**
- Create: `server/middleware/auth.js`

**Step 1: Create auth middleware**

Create file `server/middleware/auth.js`:
```javascript
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' })
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

**Step 2: Commit**

```bash
git add server/middleware/auth.js
git commit -m "feat: add JWT auth middleware"
```

---

### Task 4: Create auth routes (register + login + me)

**Files:**
- Create: `server/routes/auth.js`

**Step 1: Create auth routes**

Create file `server/routes/auth.js`:
```javascript
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { generateToken, authenticate } from '../middleware/auth.js'

export default function authRoutes(prisma) {
  const router = Router()

  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' })
      }

      const hashed = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { email, password: hashed, name: name || null },
      })

      const token = generateToken(user.id)
      res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } })
    } catch (err) {
      res.status(500).json({ error: 'Registration failed' })
    }
  })

  router.post('/login', async (req, res) => {
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
      res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
    } catch (err) {
      res.status(500).json({ error: 'Login failed' })
    }
  })

  router.get('/me', authenticate, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, createdAt: true },
      })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }
      res.json({ user })
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user' })
    }
  })

  return router
}
```

**Step 2: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat: add register, login, me auth routes"
```

---

### Task 5: Create places CRUD routes

**Files:**
- Create: `server/routes/places.js`

**Step 1: Create places routes**

Create file `server/routes/places.js`:
```javascript
import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'

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
      const { name, lat, lng, address, category, notes, rating, cuisine, tags } = req.body

      if (!name || lat == null || lng == null) {
        return res.status(400).json({ error: 'Name, lat, lng are required' })
      }

      const place = await prisma.place.create({
        data: {
          name,
          lat,
          lng,
          address: address || '',
          category: category || 'other',
          notes: notes || '',
          rating: rating || 0,
          cuisine: cuisine || 'None',
          tags: tags || [],
          userId: req.userId,
        },
      })
      res.status(201).json({ place })
    } catch (err) {
      res.status(500).json({ error: 'Failed to create place' })
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

      const { name, lat, lng, address, category, notes, rating, cuisine, tags } = req.body
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
```

**Step 2: Commit**

```bash
git add server/routes/places.js
git commit -m "feat: add places CRUD routes"
```

---

### Task 6: Create categories routes

**Files:**
- Create: `server/routes/categories.js`

**Step 1: Create categories routes**

Create file `server/routes/categories.js`:
```javascript
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

      // Delete existing and replace
      await prisma.category.deleteMany({ where: { userId: req.userId } })
      const created = await prisma.category.createMany({
        data: categories.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          icon: c.icon,
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
```

**Step 2: Commit**

```bash
git add server/routes/categories.js
git commit -m "feat: add categories routes"
```

---

### Task 7: Update Vite config with API proxy

**Files:**
- Modify: `vite.config.js`

**Step 1: Add proxy configuration**

Replace `vite.config.js` with:
```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

**Step 2: Commit**

```bash
git add vite.config.js
git commit -m "feat: add Vite proxy for /api to Express backend"
```

---

### Task 8: Update dev.sh to run both servers

**Files:**
- Modify: `dev.sh`
- Modify: `package.json` (add scripts)

**Step 1: Add server script to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "node --env-file=.env server/index.js",
    "dev:all": "concurrently -n fe,be -c cyan,green \"vite\" \"node --watch --env-file=.env server/index.js\"",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 2: Update `dev.sh`**

Replace `dev.sh` with:
```bash
#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Install dependencies if node_modules is missing or package.json changed
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "Installing dependencies..."
  npm install
fi

# Generate Prisma client if needed
if [ ! -d node_modules/.prisma/client ]; then
  echo "Generating Prisma client..."
  npx prisma generate
fi

# Check for .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and set your DATABASE_URL."
  exit 1
fi

echo "Starting Mappsly (frontend + backend)..."
exec npm run dev:all
```

**Step 3: Commit**

```bash
git add dev.sh package.json
git commit -m "feat: update dev.sh to run frontend + backend concurrently"
```

---

### Task 9: Create frontend API client and auth composable

**Files:**
- Create: `src/api.js`
- Create: `src/composables/useAuth.js`
- Create: `src/stores/auth.js`

**Step 1: Create API client**

Create file `src/api.js`:
```javascript
const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('mappsly-token')
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('mappsly-token', token)
  } else {
    localStorage.removeItem('mappsly-token')
  }
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    setToken(null)
    window.dispatchEvent(new Event('auth:logout'))
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
```

**Step 2: Create auth store**

Create file `src/stores/auth.js`:
```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, setToken } from '../api.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!user.value)

  async function init() {
    const token = localStorage.getItem('mappsly-token')
    if (!token) {
      loading.value = false
      return
    }
    try {
      const data = await api.get('/auth/me')
      user.value = data.user
    } catch {
      setToken(null)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password })
    setToken(data.token)
    user.value = data.user
  }

  async function register(email, password, name) {
    const data = await api.post('/auth/register', { email, password, name })
    setToken(data.token)
    user.value = data.user
  }

  function logout() {
    setToken(null)
    user.value = null
  }

  // Listen for 401 forced logout
  window.addEventListener('auth:logout', () => {
    user.value = null
  })

  return { user, loading, isAuthenticated, init, login, register, logout }
})
```

**Step 3: Commit**

```bash
git add src/api.js src/stores/auth.js
git commit -m "feat: add API client and auth store"
```

---

### Task 10: Create AuthModal component

**Files:**
- Create: `src/components/AuthModal.vue`

**Step 1: Create the auth modal**

Create file `src/components/AuthModal.vue`:
```vue
<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const mode = ref('login')
const email = ref('')
const password = ref('')
const name = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(email.value, password.value)
    } else {
      await authStore.register(email.value, password.value, name.value)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

function toggle() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}
</script>

<template>
  <div class="auth-overlay">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-logo">Mappsly</h1>
        <p class="auth-subtitle">{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</p>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <div v-if="mode === 'register'" class="field">
          <label for="name">Name</label>
          <input id="name" v-model="name" type="text" placeholder="Your name" autocomplete="name" />
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" placeholder="you@example.com" required autocomplete="email" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" placeholder="Password" required autocomplete="current-password" minlength="6" />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="auth-submit" :disabled="submitting">
          {{ submitting ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account') }}
        </button>
      </form>

      <p class="auth-toggle">
        {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
        <button @click="toggle" class="toggle-btn">
          {{ mode === 'login' ? 'Sign up' : 'Sign in' }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 40px 32px;
  box-shadow: var(--shadow-lg);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-logo {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 8px;
}

.auth-subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.field input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 12px 14px;
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--transition);
}

.field input:focus {
  border-color: var(--accent);
}

.field input::placeholder {
  color: var(--text-muted);
}

.auth-error {
  color: var(--danger);
  font-size: 13px;
  text-align: center;
}

.auth-submit {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 13px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--transition);
  margin-top: 4px;
}

.auth-submit:hover:not(:disabled) {
  background: var(--accent-hover);
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-toggle {
  text-align: center;
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-muted);
}

.toggle-btn {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
}

.toggle-btn:hover {
  color: var(--accent-hover);
}
</style>
```

**Step 2: Commit**

```bash
git add src/components/AuthModal.vue
git commit -m "feat: add AuthModal component for login/register"
```

---

### Task 11: Modify places store to use API instead of localStorage

**Files:**
- Modify: `src/stores/places.js`

**Step 1: Rewrite places store**

Replace `src/stores/places.js`. Key changes:
- Remove all localStorage read/write
- Add `fetchPlaces()` that calls `GET /api/places`
- `addPlace()` calls `POST /api/places`
- `updatePlace()` calls `PUT /api/places/:id`
- `removePlace()` calls `DELETE /api/places/:id`
- Keep local computed properties (filteredPlaces, etc.) working on the fetched array
- Keep `CUISINE_TYPES`, `DEFAULT_CATEGORIES`, `ICON_TO_CATEGORY`, `convertGeoJSONToPlaces` for use in discovery/import
- Categories: `fetchCategories()` from API, `saveCategories()` via `PUT /api/categories`

The full replacement for `src/stores/places.js`:
```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api.js'

const ICON_TO_CATEGORY = {
  restaurant: 'restaurant',
  bar: 'bar',
  cafe: 'cafe',
  nightclub: 'nightclub',
  bakery: 'bakery',
  generic: 'other',
  wine: 'bar',
  beer: 'bar',
  lodging: 'hotel',
  fastfood: 'fast-food',
  monument: 'culture',
  shopping: 'shopping',
  supermarket: 'shopping',
  fitness: 'other',
  parking: 'other',
  geocode: 'other',
}

const DEFAULT_CATEGORIES = [
  { id: 'favorite', name: 'Favorites', color: '#f59e0b', icon: 'star' },
  { id: 'restaurant', name: 'Restaurant', color: '#ef4444', icon: 'utensils' },
  { id: 'bar', name: 'Bar', color: '#a855f7', icon: 'glass' },
  { id: 'cafe', name: 'Cafe', color: '#f97316', icon: 'coffee' },
  { id: 'brunch', name: 'Brunch', color: '#ec4899', icon: 'brunch' },
  { id: 'fast-food', name: 'Fast Food', color: '#eab308', icon: 'burger' },
  { id: 'bakery', name: 'Bakery', color: '#d97706', icon: 'bread' },
  { id: 'nightclub', name: 'Nightclub', color: '#7c3aed', icon: 'music' },
  { id: 'shopping', name: 'Shopping', color: '#8b5cf6', icon: 'bag' },
  { id: 'nature', name: 'Nature', color: '#22c55e', icon: 'tree' },
  { id: 'culture', name: 'Culture', color: '#3b82f6', icon: 'museum' },
  { id: 'hotel', name: 'Hotel', color: '#0ea5e9', icon: 'bed' },
  { id: 'other', name: 'Other', color: '#64748b', icon: 'pin' },
]

const CUISINE_TYPES = [
  'None', 'African', 'American', 'Asian', 'Brazilian', 'Caribbean',
  'Chinese', 'Ethiopian', 'French', 'Greek', 'Indian', 'Italian',
  'Japanese', 'Korean', 'Lebanese', 'Mediterranean', 'Mexican',
  'Moroccan', 'Peruvian', 'Spanish', 'Thai', 'Turkish', 'Vegan',
  'Vegetarian', 'Vietnamese', 'Other',
]

export { ICON_TO_CATEGORY }

export const usePlacesStore = defineStore('places', () => {
  const places = ref([])
  const categories = ref([...DEFAULT_CATEGORIES])
  const selectedPlaceId = ref(null)
  const filterCategory = ref(null)
  const filterCuisine = ref(null)
  const filterTag = ref(null)
  const filterMinRating = ref(0)
  const searchQuery = ref('')
  const loaded = ref(false)

  const allTags = computed(() => {
    const tagSet = new Set()
    places.value.forEach(p => {
      if (p.tags) p.tags.forEach(t => tagSet.add(t))
    })
    return [...tagSet].sort()
  })

  const filteredPlaces = computed(() => {
    let result = places.value
    if (filterCategory.value) {
      result = result.filter(p => p.category === filterCategory.value)
    }
    if (filterCuisine.value) {
      result = result.filter(p => p.cuisine === filterCuisine.value)
    }
    if (filterTag.value) {
      result = result.filter(p => p.tags && p.tags.includes(filterTag.value))
    }
    if (filterMinRating.value > 0) {
      result = result.filter(p => (p.rating || 0) >= filterMinRating.value)
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.cuisine && p.cuisine.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      )
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })

  const selectedPlace = computed(() =>
    places.value.find(p => p.id === selectedPlaceId.value) || null
  )

  const placeCount = computed(() => places.value.length)

  const categoryCounts = computed(() => {
    const counts = {}
    places.value.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  })

  async function fetchPlaces() {
    const data = await api.get('/places')
    places.value = data.places
    loaded.value = true
  }

  async function fetchCategories() {
    try {
      const data = await api.get('/categories')
      if (data.categories.length > 0) {
        categories.value = data.categories
      }
    } catch {
      // Use defaults
    }
  }

  async function saveCategories() {
    await api.put('/categories', { categories: categories.value })
  }

  async function addPlace({ name, lat, lng, address = '', category = 'other', notes = '', rating = 0, cuisine = 'None', tags = [] }) {
    const data = await api.post('/places', { name, lat, lng, address, category, notes, rating, cuisine, tags })
    places.value.unshift(data.place)
    selectedPlaceId.value = data.place.id
    return data.place
  }

  async function updatePlace(id, updates) {
    const data = await api.put(`/places/${id}`, updates)
    const index = places.value.findIndex(p => p.id === id)
    if (index !== -1) {
      places.value[index] = data.place
    }
  }

  async function removePlace(id) {
    await api.delete(`/places/${id}`)
    places.value = places.value.filter(p => p.id !== id)
    if (selectedPlaceId.value === id) {
      selectedPlaceId.value = null
    }
  }

  function selectPlace(id) {
    selectedPlaceId.value = id
  }

  function clearSelection() {
    selectedPlaceId.value = null
  }

  function getCategoryById(id) {
    return categories.value.find(c => c.id === id) || categories.value[categories.value.length - 1]
  }

  function clearAllFilters() {
    filterCategory.value = null
    filterCuisine.value = null
    filterTag.value = null
    filterMinRating.value = 0
    searchQuery.value = ''
  }

  function exportPlaces() {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      places: places.value,
      categories: categories.value,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mappsly-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importPlaces(jsonString) {
    try {
      const data = JSON.parse(jsonString)
      if (data.places && Array.isArray(data.places)) {
        const existingIds = new Set(places.value.map(p => p.id))
        const newPlaces = data.places.filter(p => !existingIds.has(p.id))
        let count = 0
        for (const p of newPlaces) {
          await addPlace({
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            address: p.address || '',
            category: p.category || 'other',
            notes: p.notes || '',
            rating: p.rating || 0,
            cuisine: p.cuisine || 'None',
            tags: p.tags || [],
          })
          count++
        }
        return count
      }
      return 0
    } catch {
      return -1
    }
  }

  return {
    places,
    categories,
    cuisineTypes: CUISINE_TYPES,
    selectedPlaceId,
    filterCategory,
    filterCuisine,
    filterTag,
    filterMinRating,
    searchQuery,
    loaded,
    allTags,
    filteredPlaces,
    selectedPlace,
    placeCount,
    categoryCounts,
    fetchPlaces,
    fetchCategories,
    saveCategories,
    addPlace,
    updatePlace,
    removePlace,
    selectPlace,
    clearSelection,
    getCategoryById,
    clearAllFilters,
    exportPlaces,
    importPlaces,
  }
})
```

**Step 2: Commit**

```bash
git add src/stores/places.js
git commit -m "feat: replace localStorage with API calls in places store"
```

---

### Task 12: Wire auth into App.vue

**Files:**
- Modify: `src/App.vue`

**Step 1: Update App.vue**

Add to `<script setup>` in `src/App.vue`:
- Import `AuthModal` and `useAuthStore`
- Call `authStore.init()` on mount
- After auth, call `placesStore.fetchPlaces()` and `placesStore.fetchCategories()`
- Show `AuthModal` when not authenticated
- Show a loading state while auth is initializing

Changes to `src/App.vue` `<script setup>` — add these imports:
```javascript
import { onMounted } from 'vue'
import AuthModal from './components/AuthModal.vue'
import { useAuthStore } from './stores/auth'
import { usePlacesStore } from './stores/places'
```

Add after existing refs:
```javascript
const authStore = useAuthStore()
const placesStore = usePlacesStore()

onMounted(async () => {
  await authStore.init()
  if (authStore.isAuthenticated) {
    await placesStore.fetchPlaces()
    await placesStore.fetchCategories()
  }
})

// Watch for login completion to load data
import { watch } from 'vue'
watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await placesStore.fetchPlaces()
    await placesStore.fetchCategories()
  }
})
```

In `<template>`, wrap the existing content and add auth guard:
```html
<ion-app>
  <!-- Loading state -->
  <div v-if="authStore.loading" class="auth-loading">
    <p class="auth-loading-text">Mappsly</p>
  </div>

  <!-- Auth modal -->
  <AuthModal v-else-if="!authStore.isAuthenticated" />

  <!-- Main app (existing content) -->
  <div v-else class="app-root">
    <!-- ... existing MapView, SearchBar, Sidebar, etc ... -->
  </div>
</ion-app>
```

Add loading styles to `<style scoped>`:
```css
.auth-loading {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.auth-loading-text {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
}
```

**Step 2: Commit**

```bash
git add src/App.vue
git commit -m "feat: wire auth guard and data loading into App.vue"
```

---

### Task 13: Add logout button to Sidebar

**Files:**
- Modify: `src/components/Sidebar.vue`

**Step 1: Add logout to Sidebar**

In `src/components/Sidebar.vue`, at the bottom of the sidebar footer area (near export/import buttons), add:

In `<script setup>`, add:
```javascript
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
```

In the template footer area, add a logout button:
```html
<button class="sidebar-btn danger" @click="authStore.logout()">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
  Sign out
</button>
```

**Step 2: Commit**

```bash
git add src/components/Sidebar.vue
git commit -m "feat: add logout button to sidebar"
```

---

### Task 14: Verify full flow end-to-end

**Step 1: Set up `.env` with real DATABASE_URL**

Ensure `.env` has valid PostgreSQL connection string.

**Step 2: Run migration**

Run:
```bash
npx prisma migrate dev --name init
```

Expected: Migration applied successfully.

**Step 3: Start dev server**

Run:
```bash
./dev.sh
```

Expected: Both frontend (Vite on :5173) and backend (Express on :3001) start.

**Step 4: Manual test**

1. Open http://localhost:5173 — should see auth modal
2. Register a new account — should enter the app
3. Add a place — should persist via API
4. Refresh the page — place should still be there (loaded from DB)
5. Logout — should return to auth modal
6. Login again — should see saved places

**Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete account system with PostgreSQL backend"
```
