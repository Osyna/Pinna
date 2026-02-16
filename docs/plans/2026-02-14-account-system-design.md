# Account System Design

## Summary

Add user accounts with email+password authentication and PostgreSQL storage to Mappsly. Replaces localStorage with per-user cloud-synced data.

## Stack

- **Backend**: Express.js + Prisma ORM
- **Database**: PostgreSQL (external URL via `DATABASE_URL` env var)
- **Auth**: bcrypt password hashing + JWT tokens
- **Frontend**: Vue 3 composables + Pinia auth store

## Architecture

```
Frontend (Vite :5173)          Backend (Express :3001)          PostgreSQL
  Vue app ──proxy /api──▶   /api/auth/*                ──▶   users
  Pinia stores              /api/places/*                     places
  useAuth composable        /api/categories/*                 categories
  Axios + JWT header        JWT middleware
```

- Vite proxies `/api/*` to Express in dev
- JWT stored in localStorage, sent via `Authorization: Bearer` header
- `DATABASE_URL` and `JWT_SECRET` as env vars in `.env`

## Data Model

```prisma
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
  address   String?
  category  String?
  notes     String?
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

## API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/places` | Yes | List user's places |
| POST | `/api/places` | Yes | Create place |
| PUT | `/api/places/:id` | Yes | Update place |
| DELETE | `/api/places/:id` | Yes | Delete place |
| GET | `/api/categories` | Yes | List user's categories |
| PUT | `/api/categories` | Yes | Bulk update categories |

## Frontend Changes

- `useAuth` composable: login, register, logout, token management
- `authStore` (Pinia): user state, isAuthenticated
- `placesStore` modified: replace localStorage with API calls
- `AuthModal.vue`: login/register UI shown when unauthenticated
- Axios instance with JWT interceptor

## File Structure (new/modified)

```
server/
  index.js              # Express entry point
  middleware/auth.js     # JWT verification
  routes/auth.js        # Register/login
  routes/places.js      # CRUD
  routes/categories.js  # CRUD
prisma/
  schema.prisma
.env                    # DATABASE_URL, JWT_SECRET
src/
  composables/useAuth.js    # (new)
  stores/auth.js            # (new)
  stores/places.js          # (modified)
  components/AuthModal.vue  # (new)
vite.config.js              # (modified: add proxy)
dev.sh                      # (modified: run both servers)
```

## Dev Setup

- `dev.sh` runs Vite + Express concurrently
- Vite config proxy: `/api` -> `http://localhost:3001`
- `.env` with `DATABASE_URL` and `JWT_SECRET`

## Decisions

- Email + password auth (no OAuth)
- Full cloud sync (no localStorage fallback)
- Prisma ORM for type-safe DB access
- JWT in localStorage with Bearer header
- Express.js backend
- Single dev.sh script for DX
