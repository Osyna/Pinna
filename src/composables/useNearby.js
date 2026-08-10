import { ref } from 'vue'

import { authHeader } from '../api.js'

// Proxied through our server (caching + rate limits)
const OVERPASS_API = '/api/geo/nearby'

// Comfortably above the server's own bounded worst case (cache lookup +
// a capped missing-cell fetch stage) — a true last-resort net for cases
// the server-side deadline can't cover (e.g. the request never lands).
const CLIENT_TIMEOUT_MS = 18000

export function useNearby() {
  const nearbyPlaces = ref([])
  const loading = ref(false)
  const error = ref(null)

  let inFlight = null

  async function fetchNearby(bounds) {
    // Re-clicking "Find in this area" (or a fast retry) while a request
    // is already running would otherwise fire a second, fully redundant
    // request — share the one already in flight instead.
    if (inFlight) return inFlight

    const south = bounds.getSouth()
    const west = bounds.getWest()
    const north = bounds.getNorth()
    const east = bounds.getEast()

    loading.value = true
    error.value = null

    const run = (async () => {
      try {
        // Structured bbox: the server snaps it to a shared cell grid, so
        // everyone's searches build one collective, self-refreshing cache
        const response = await fetch(OVERPASS_API, {
          method: 'POST',
          body: JSON.stringify({ south, west, north, east }),
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
        })

        if (!response.ok) throw new Error('Failed to fetch nearby places')

        const data = await response.json()

        nearbyPlaces.value = data.elements
          .filter(el => el.tags && el.tags.name)
          .map(el => ({
            id: `osm-${el.id}`,
            osmId: el.id,
            name: el.tags.name,
            lat: el.lat,
            lng: el.lon,
            amenity: el.tags.amenity || '',
            cuisine: el.tags.cuisine || '',
            address: [el.tags['addr:housenumber'], el.tags['addr:street'], el.tags['addr:city']].filter(Boolean).join(', '),
            phone: el.tags.phone || '',
            website: el.tags.website || '',
            openingHours: el.tags.opening_hours || '',
          }))

        return nearbyPlaces.value
      } catch (err) {
        error.value = err.name === 'TimeoutError' ? 'Timed out — tap to retry' : err.message
        nearbyPlaces.value = []
        return null
      } finally {
        loading.value = false
        inFlight = null
      }
    })()

    inFlight = run
    return run
  }

  function clearNearby() {
    nearbyPlaces.value = []
    error.value = null
  }

  return {
    nearbyPlaces,
    loading,
    error,
    fetchNearby,
    clearNearby,
  }
}
