/**
 * Overpass grid quantization.
 *
 * Nearby searches are snapped to a fixed lat/lng cell grid so that
 * different users (and small map pans) reuse the same cached cells —
 * every request grows a shared database of "what's around here".
 *
 * Freshness is handled by the caller with two TTLs:
 *  - SOFT (fresh): serve directly
 *  - HARD (stale): serve instantly but revalidate in the background,
 *    so reality changes (closed/new places) appear within ~a day of
 *    anyone viewing the area, without ever blocking the UX.
 */

export const CELL_SIZE = 0.02 // degrees ≈ 2.2 km N-S
export const MAX_CELLS = 12

export function cellKey(cx, cy) {
  return `ovp1|${cx}|${cy}`
}

export function cellBbox(cx, cy) {
  const west = cx * CELL_SIZE
  const south = cy * CELL_SIZE
  return { south, west, north: south + CELL_SIZE, east: west + CELL_SIZE }
}

/**
 * Cells covering a bbox. If the area needs more than maxCells, the
 * cell size is scaled up by powers of 2 so the count stays bounded
 * (bigger cells for bigger viewports — still perfectly cacheable).
 */
export function cellsForBbox({ south, west, north, east }, maxCells = MAX_CELLS) {
  let size = CELL_SIZE
  let factor = 1
  for (let i = 0; i < 12; i++) {
    const cols = Math.floor(east / size) - Math.floor(west / size) + 1
    const rows = Math.floor(north / size) - Math.floor(south / size) + 1
    if (cols * rows <= maxCells) break
    size *= 2
    factor *= 2
  }
  const cells = []
  const x0 = Math.floor(west / size)
  const x1 = Math.floor(east / size)
  const y0 = Math.floor(south / size)
  const y1 = Math.floor(north / size)
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      cells.push({
        key: `ovp${factor}|${cx}|${cy}`,
        bbox: {
          south: cy * size,
          west: cx * size,
          north: (cy + 1) * size,
          east: (cx + 1) * size,
        },
      })
    }
  }
  return cells
}

const AMENITIES = 'restaurant|bar|cafe|pub|fast_food|biergarten|food_court|ice_cream|bakery|nightclub'

export function buildCellQuery({ south, west, north, east }) {
  return `[out:json][timeout:15];(node["amenity"~"${AMENITIES}"](${south},${west},${north},${east}););out body 120;`
}

/** Merge cell element arrays, de-duplicated by OSM element id. */
export function mergeElements(cellResults, limit = 200) {
  const seen = new Set()
  const out = []
  for (const elements of cellResults) {
    for (const el of elements || []) {
      if (el && el.id != null && !seen.has(el.id)) {
        seen.add(el.id)
        out.push(el)
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

/** Haversine distance in meters — cheap enough for a per-request sort of ≤a few hundred points. */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Grid cells always fully cover the requested bbox, so they routinely
 * extend past it — a query near a cell edge otherwise returns markers
 * that sit outside the viewport the user actually asked about. This
 * trims the merged set back down to what was really requested (with a
 * small buffer so points right on the edge aren't lost to float
 * rounding), then orders by distance to the viewport center so any
 * later truncation drops the farthest points first, not an arbitrary
 * OSM-id-ordered tail.
 */
export function refineToViewport(elements, bbox, limit = 200) {
  const { south, west, north, east } = bbox
  const padLat = (north - south) * 0.02
  const padLng = (east - west) * 0.02
  const inView = elements.filter((el) => {
    if (el?.lat == null || el?.lon == null) return false
    return (
      el.lat >= south - padLat &&
      el.lat <= north + padLat &&
      el.lon >= west - padLng &&
      el.lon <= east + padLng
    )
  })
  const cLat = (south + north) / 2
  const cLng = (west + east) / 2
  inView.sort((a, b) => distanceMeters(a.lat, a.lon, cLat, cLng) - distanceMeters(b.lat, b.lon, cLat, cLng))
  return inView.slice(0, limit)
}
