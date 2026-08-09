import { describe, it, expect } from 'vitest'
import {
  CATEGORY_ICON_PATHS, iconPathFor, categoryIconSvg, markerImageId,
} from '../src/categoryIcons.js'

describe('categoryIcons', () => {
  it('has a path for every default category icon name', () => {
    const names = ['star', 'utensils', 'glass', 'coffee', 'brunch', 'burger',
      'bread', 'music', 'bag', 'tree', 'museum', 'bed', 'pin', 'cross']
    for (const n of names) expect(CATEGORY_ICON_PATHS[n], n).toBeTruthy()
  })

  it('falls back to the pin icon for unknown names', () => {
    expect(iconPathFor('definitely-not-an-icon')).toBe(CATEGORY_ICON_PATHS.pin)
    expect(iconPathFor(undefined)).toBe(CATEGORY_ICON_PATHS.pin)
  })

  it('renders an SVG string with the requested size', () => {
    const svg = categoryIconSvg('tree', { size: 18 })
    expect(svg).toContain('width="18"')
    expect(svg).toContain(CATEGORY_ICON_PATHS.tree)
  })

  it('encodes icon AND color into the marker image id', () => {
    const a = markerImageId({ icon: 'bag', color: '#111111' })
    const b = markerImageId({ icon: 'bag', color: '#222222' })
    expect(a).not.toBe(b)
    expect(markerImageId(null)).toBe('cat-marker|pin|#8E8E93')
  })
})
