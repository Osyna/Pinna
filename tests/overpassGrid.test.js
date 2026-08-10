import { describe, it, expect } from 'vitest'
import { cellsForBbox, buildCellQuery, mergeElements, refineToViewport, distanceMeters, CELL_SIZE, MAX_CELLS } from '../server/lib/overpassGrid.js'

describe('overpass grid', () => {
  it('snaps a small bbox to a bounded set of cells', () => {
    const cells = cellsForBbox({ south: 50.83, west: 4.40, north: 50.85, east: 4.43 })
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.length).toBeLessThanOrEqual(MAX_CELLS)
    // cells must cover the bbox
    const s = Math.min(...cells.map(c => c.bbox.south))
    const n = Math.max(...cells.map(c => c.bbox.north))
    expect(s).toBeLessThanOrEqual(50.83)
    expect(n).toBeGreaterThanOrEqual(50.85)
  })

  it('is stable: same viewport -> same keys; small pan reuses most cells', () => {
    const a = cellsForBbox({ south: 50.830, west: 4.400, north: 50.850, east: 4.430 })
    const b = cellsForBbox({ south: 50.831, west: 4.401, north: 50.851, east: 4.431 })
    const keysA = new Set(a.map(c => c.key))
    const shared = b.filter(c => keysA.has(c.key)).length
    expect(shared / b.length).toBeGreaterThan(0.5)
  })

  it('scales cell size up for huge viewports instead of exploding', () => {
    const cells = cellsForBbox({ south: 45, west: 0, north: 52, east: 9 })
    expect(cells.length).toBeLessThanOrEqual(MAX_CELLS)
  })

  it('builds a bounded overpass query per cell', () => {
    const q = buildCellQuery({ south: 1, west: 2, north: 3, east: 4 })
    expect(q).toContain('(1,2,3,4)')
    expect(q).toContain('amenity')
  })

  it('merges cells and de-duplicates by element id', () => {
    const merged = mergeElements([
      [{ id: 1 }, { id: 2 }],
      [{ id: 2 }, { id: 3 }],
    ])
    expect(merged.map(e => e.id)).toEqual([1, 2, 3])
  })
})

describe('refineToViewport (bbox precision + distance order)', () => {
  const bbox = { south: 50.0, west: 4.0, north: 50.1, east: 4.1 } // ~11km x ~7km, center 50.05,4.05

  it('drops elements outside the requested bbox even if the covering cell is larger', () => {
    const elements = [
      { id: 1, lat: 50.05, lon: 4.05 },   // dead center — in view
      { id: 2, lat: 50.5, lon: 4.5 },     // far outside — cell padding, not viewport
    ]
    const out = refineToViewport(elements, bbox)
    expect(out.map(e => e.id)).toEqual([1])
  })

  it('keeps points on the edge (small tolerance for float rounding)', () => {
    const elements = [{ id: 1, lat: 50.1, lon: 4.05 }] // exactly on the north edge
    const out = refineToViewport(elements, bbox)
    expect(out.map(e => e.id)).toEqual([1])
  })

  it('orders surviving elements closest-to-center first', () => {
    const elements = [
      { id: 'far', lat: 50.09, lon: 4.09 },
      { id: 'near', lat: 50.051, lon: 4.051 },
      { id: 'mid', lat: 50.07, lon: 4.07 },
    ]
    const out = refineToViewport(elements, bbox)
    expect(out.map(e => e.id)).toEqual(['near', 'mid', 'far'])
  })

  it('caps to the given limit after sorting, so truncation drops the farthest first', () => {
    const elements = [
      { id: 'near', lat: 50.051, lon: 4.051 },
      { id: 'far', lat: 50.09, lon: 4.09 },
    ]
    const out = refineToViewport(elements, bbox, 1)
    expect(out.map(e => e.id)).toEqual(['near'])
  })

  it('drops elements with missing coordinates rather than crashing', () => {
    const elements = [{ id: 1, lat: 50.05, lon: 4.05 }, { id: 2 }]
    const out = refineToViewport(elements, bbox)
    expect(out.map(e => e.id)).toEqual([1])
  })
})

describe('distanceMeters', () => {
  it('is ~0 for the same point', () => {
    expect(distanceMeters(48.85, 2.35, 48.85, 2.35)).toBeLessThan(1)
  })

  it('roughly matches a known real-world distance (Paris <-> London ~344km)', () => {
    const d = distanceMeters(48.8566, 2.3522, 51.5074, -0.1278)
    expect(d).toBeGreaterThan(330000)
    expect(d).toBeLessThan(360000)
  })
})
