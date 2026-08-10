import { describe, it, expect } from 'vitest'
import {
  CATEGORY_ICON_PATHS, iconPathFor, categoryIconSvg, markerImageId,
  DEFAULT_CATEGORIES, AMENITY_STYLE, amenityStyle, nearbyImageId,
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

describe('DEFAULT_CATEGORIES / AMENITY_STYLE unification', () => {
  // Regression test for a real bug: stores/places.js and stores/friends.js
  // used to each hand-maintain their own copy of this list, and drifted —
  // a friend's "Restaurant" category rendered in a different red (#ef4444)
  // than your own (#FF3B30). Both stores now import DEFAULT_CATEGORIES
  // from here directly, so this is the one place that can ever define it.
  it('has exactly one entry per category id (no accidental duplicates)', () => {
    const ids = DEFAULT_CATEGORIES.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every default category has a real icon path and a hex color', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(CATEGORY_ICON_PATHS[cat.icon], cat.id).toBeTruthy()
      expect(cat.color, cat.id).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('covers every filter SearchView/Discover offers, so pins can never fall back to a bare "pin" icon for a known type', () => {
    const searchFilterKeys = ['restaurant', 'cafe', 'bar', 'hotel', 'shop', 'museum', 'park', 'pharmacy']
    for (const key of searchFilterKeys) {
      expect(AMENITY_STYLE[key], key).toBeTruthy()
      expect(AMENITY_STYLE[key].icon).not.toBe('pin')
    }
  })

  it('derives OSM amenity styles from the same palette as the matching saved category (no drift)', () => {
    const byId = (id) => DEFAULT_CATEGORIES.find(c => c.id === id)
    expect(AMENITY_STYLE.restaurant).toEqual({ icon: byId('restaurant').icon, color: byId('restaurant').color })
    expect(AMENITY_STYLE.hotel).toEqual({ icon: byId('hotel').icon, color: byId('hotel').color })
    expect(AMENITY_STYLE.museum).toEqual({ icon: byId('culture').icon, color: byId('culture').color })
    expect(AMENITY_STYLE.park).toEqual({ icon: byId('nature').icon, color: byId('nature').color })
    expect(AMENITY_STYLE.shop).toEqual({ icon: byId('shopping').icon, color: byId('shopping').color })
  })

  it('amenityStyle() still falls back gracefully for unknown/generic Nominatim types', () => {
    expect(amenityStyle('administrative')).toEqual({ icon: 'pin', color: '#8E8E93' })
    expect(amenityStyle(undefined)).toEqual({ icon: 'pin', color: '#8E8E93' })
    expect(amenityStyle('')).toEqual({ icon: 'pin', color: '#8E8E93' })
  })

  it('nearbyImageId encodes the resolved icon+color, not the raw amenity string', () => {
    expect(nearbyImageId('restaurant')).toBe('nearby-marker|utensils|#FF3B30')
    expect(nearbyImageId('totally-unknown-type')).toBe('nearby-marker|pin|#8E8E93')
  })
})
