# Mappsly

Open-source mapping application built with Vue 3, Vite, and OpenStreetMap. A free alternative to proprietary mapping apps, with no account required.

## Features

- **Interactive Map** - Full OpenStreetMap integration via Leaflet with dark, street, and satellite tile layers
- **Place Search** - Search addresses and places using the Nominatim geocoding API
- **Save Places** - Click anywhere on the map to save locations with names, notes, and categories
- **Categories** - Organize saved places into categories (Favorites, Food & Drink, Shopping, Nature, Culture, Other)
- **Directions** - Get driving routes between saved places using OSRM
- **Import/Export** - Export all saved places to JSON, import from file
- **Local Storage** - All data stored in browser localStorage, no account needed
- **Dark Theme** - Modern dark UI throughout

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Docker

```bash
docker build -t mappsly .
docker run -p 8080:80 mappsly
```

Then open http://localhost:8080

## Tech Stack

- **Vue 3** - Composition API with `<script setup>`
- **Vite** - Build tool
- **Leaflet** - Map rendering
- **Pinia** - State management
- **OpenStreetMap** - Tile data
- **Nominatim** - Geocoding / place search
- **OSRM** - Routing / directions
- **Nginx** - Production serving (Docker)
