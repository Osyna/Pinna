# Pinna

Open-source mapping application with a playful **cartoon-game UI** — chunky ink outlines, cream paper surfaces, and press-down buttons. Built with Vue 3, Vite, and MapLibre GL on OpenStreetMap data: save the places you love, organize them by category, and share your map with friends.

![Map Overview](./assets/Global-Overview.png)

## 🚀 Live Demo

You can try the live demo at: **[maps.osyna.com](https://maps.osyna.com)**

**Credentials for testing:**
- **Email:** `test@test.com`
- **Password:** `test@test.com`

## Features

- **Cartoon Game UI** - The app's signature look: 3px ink outlines, cream paper, `Baloo 2` display type, pop/bob animations and buttons that physically press down.
- **Interactive Map** - MapLibre GL with Default, Streets, and Satellite tile layers, smooth fly-to animations and marker clustering.
- **Icons + Colors** - Every category is encoded by an icon *and* a color — on map markers, in the legend, in popups — never by color alone (color-blind friendly).
- **Place Search** - Search addresses via Nominatim and discover restaurants, cafes, bars and more from OpenStreetMap, worldwide or near you.
- **Save Places** - Tap anywhere on the map to save a spot with notes, rating, cuisine, tags and website.
- **Categories** - 13 built-in categories (Restaurant, Bar, Cafe, Bakery, Nature, Culture, Hotel…), each with its own icon and color; fully customizable.
- **Friends** - Add friends by user ID, browse their maps, and see when friends saved the same place as you.
- **Directions** - Driving routes to any saved place using OSRM.
- **Import/Export** - Export all saved places to JSON, import from file.
- **Accounts & Sync** - JWT-authenticated accounts with avatars, favorite cuisines and favorite places, backed by PostgreSQL.

## Screenshots

| Map View | Place Details |
| :---: | :---: |
| ![Map Screen](./assets/Map-Screen.png) | ![Place Preview](./assets/Place-Preview.png) |

| Search | My Places |
| :---: | :---: |
| ![Search](./assets/Search.png) | ![My Places](./assets/MyPlaces.png) |

| Friends | Profile |
| :---: | :---: |
| ![Friends](./assets/Friends.png) | ![Profile](./assets/Profil..png) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- PostgreSQL (for the API server)

### Development

```bash
npm install
cp .env.example .env   # set DATABASE_URL + JWT_SECRET
npm run dev:all        # frontend (Vite) + API server together
```

Frontend only:

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Docker

```bash
docker build -t pinna .
docker run -p 8080:80 -e DATABASE_URL=postgres://... pinna
```

Then open http://localhost:8080

## Tech Stack

- **Vue 3** - Composition API for modern frontend logic.
- **Vite** - High-performance build tool.
- **MapLibre GL** - GPU-accelerated vector map rendering.
- **Pinia** - Intuitive state management.
- **OpenStreetMap** - Global open tile data.
- **Nominatim** - Accurate geocoding & search.
- **OSRM** - Efficient routing service.
- **Express + Prisma** - REST API with PostgreSQL persistence and JWT auth.
- **Nginx** - Production-ready serving (Docker).

## Design

The cartoon UI was designed in [Claude Design](https://claude.ai/design) ("Cartoon game UI overhaul") and implemented 1:1 in Vue: the design tokens, category icon set and motion language live in `src/styles/cartoon.scss` and `src/categoryIcons.js`.
