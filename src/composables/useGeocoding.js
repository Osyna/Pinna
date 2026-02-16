import { ref } from 'vue'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

const FOOD_DRINK_TYPES = new Set([
  'restaurant', 'bar', 'cafe', 'pub', 'fast_food', 'biergarten',
  'food_court', 'ice_cream', 'bakery', 'nightclub', 'bistro',
])

export function useGeocoding() {
  const results = ref([])
  const loading = ref(false)
  const error = ref(null)

  let abortController = null

  /**
   * Search with optional viewbox for location-aware results.
   * @param {string} query - search text
   * @param {{ south: number, west: number, north: number, east: number }} [viewbox] - map bounds for local bias
   * @param {{ typeFilter?: string, countryCode?: string, city?: string }} [opts]
   */
  async function search(query, viewbox, { typeFilter, countryCode, city } = {}) {
    if (!query || query.trim().length < 2) {
      results.value = []
      return
    }

    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    loading.value = true
    error.value = null

    try {
      const allResults = []
      const q = query.trim()
      const signal = abortController.signal
      const headers = { 'Accept-Language': 'en' }

      // Build viewbox string for Nominatim: west,north,east,south
      const vb = viewbox
        ? `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}`
        : null

      // Append city to query if provided
      const cityQ = city ? `${q} ${city}` : q

      // Helper to apply countrycodes to a URLSearchParams
      const applyCountry = (params) => {
        if (countryCode) params.set('countrycodes', countryCode)
      }

      // --- Pass 1: Bounded local search (only if viewbox available) ---
      if (vb) {
        const localParams = new URLSearchParams({
          q: cityQ,
          format: 'json',
          addressdetails: '1',
          extratags: '1',
          limit: '8',
          viewbox: vb,
          bounded: '1',
        })
        applyCountry(localParams)

        try {
          const resp = await fetch(`${NOMINATIM_BASE}/search?${localParams}`, { signal, headers })
          if (resp.ok) {
            const data = await resp.json()
            // Tag as local
            data.forEach(item => { item._local = true })
            allResults.push(...data)
          }
        } catch (e) {
          if (e.name === 'AbortError') throw e
        }
      }

      // --- Pass 2: Type-biased search ---
      // When typeFilter is active, prefix query with the type.
      // Otherwise use "cafe" prefix for general food discovery.
      {
        const alreadyHasType = /^(cafe|café|restaurant|bar|pub|bakery|hotel|museum|park|pharmacy|shop)\b/i.test(cityQ)
        const biasedQ = typeFilter
          ? (alreadyHasType ? cityQ : `${typeFilter} ${cityQ}`)
          : (alreadyHasType ? cityQ : `cafe ${cityQ}`)
        const biasedParams = new URLSearchParams({
          q: biasedQ,
          format: 'json',
          addressdetails: '1',
          limit: '8',
          extratags: '1',
        })
        if (vb) biasedParams.set('viewbox', vb)
        applyCountry(biasedParams)

        try {
          const resp = await fetch(`${NOMINATIM_BASE}/search?${biasedParams}`, { signal, headers })
          if (resp.ok) allResults.push(...(await resp.json()))
        } catch (e) {
          if (e.name === 'AbortError') throw e
        }
      }

      // --- Pass 3: Direct name search (viewbox-biased but not bounded) ---
      // When typeFilter is active, prefix the direct search too for better relevance
      const directQ = typeFilter && !/^(cafe|café|restaurant|bar|pub|bakery|hotel|museum|park|pharmacy|shop)\b/i.test(cityQ)
        ? `${typeFilter} ${cityQ}`
        : cityQ
      const directParams = new URLSearchParams({
        q: directQ,
        format: 'json',
        addressdetails: '1',
        limit: '6',
        extratags: '1',
      })
      if (vb) directParams.set('viewbox', vb)
      applyCountry(directParams)

      try {
        const resp = await fetch(`${NOMINATIM_BASE}/search?${directParams}`, { signal, headers })
        if (resp.ok) allResults.push(...(await resp.json()))
      } catch (e) {
        if (e.name === 'AbortError') throw e
      }

      // Deduplicate, preserving _local flag
      const seen = new Map()
      allResults.forEach(item => {
        if (!seen.has(item.place_id)) {
          seen.set(item.place_id, item)
        } else if (item._local) {
          // If we already have it but this one is local, mark the existing as local
          seen.get(item.place_id)._local = true
        }
      })
      const unique = [...seen.values()]

      const mapped = unique.map(item => {
        const isFoodDrink = FOOD_DRINK_TYPES.has(item.type) ||
          (item.extratags && FOOD_DRINK_TYPES.has(item.extratags.amenity))
        const addr = item.address || {}
        return {
          id: item.place_id,
          name: item.display_name.split(',')[0],
          fullName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          category: item.category,
          address: item.display_name,
          isFoodDrink,
          isLocal: !!item._local,
          // Address components for tier grouping
          city: addr.city || addr.town || addr.village || addr.municipality || '',
          state: addr.state || addr.county || '',
          country: addr.country || '',
          website: item.extratags?.website || '',
        }
      })

      // Sort: local results first, then food/drink, then rest
      mapped.sort((a, b) => {
        if (a.isLocal !== b.isLocal) return b.isLocal ? 1 : -1
        if (a.isFoodDrink !== b.isFoodDrink) return b.isFoodDrink ? 1 : -1
        return 0
      })

      results.value = mapped.slice(0, 12)
    } catch (err) {
      if (err.name !== 'AbortError') {
        error.value = err.message
        results.value = []
      }
    } finally {
      loading.value = false
    }
  }

  async function reverseGeocode(lat, lng) {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
      })

      const response = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
        headers: { 'Accept-Language': 'en' },
      })

      if (!response.ok) throw new Error('Reverse geocoding failed')

      const data = await response.json()
      return {
        name: data.display_name.split(',')[0],
        fullName: data.display_name,
        address: data.display_name,
      }
    } catch {
      return {
        name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        fullName: '',
        address: '',
      }
    }
  }

  function clearResults() {
    results.value = []
  }

  return {
    results,
    loading,
    error,
    search,
    reverseGeocode,
    clearResults,
  }
}
