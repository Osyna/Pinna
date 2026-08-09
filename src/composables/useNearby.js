import { ref } from 'vue'

import { authHeader } from '../api.js'

// Proxied through our server (caching + rate limits)
const OVERPASS_API = '/api/geo/nearby'

export function useNearby() {
  const nearbyPlaces = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchNearby(bounds) {
    loading.value = true
    error.value = null

    const south = bounds.getSouth()
    const west = bounds.getWest()
    const north = bounds.getNorth()
    const east = bounds.getEast()

    try {
      // Structured bbox: the server snaps it to a shared cell grid, so
      // everyone's searches build one collective, self-refreshing cache
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        body: JSON.stringify({ south, west, north, east }),
        headers: { 'Content-Type': 'application/json', ...authHeader() },
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
      error.value = err.message
      nearbyPlaces.value = []
      return null
    } finally {
      loading.value = false
    }
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
