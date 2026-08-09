import { describe, it, expect } from 'vitest'
import { cellsForBbox, buildCellQuery, mergeElements, CELL_SIZE, MAX_CELLS } from '../server/lib/overpassGrid.js'

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
