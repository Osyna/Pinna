import { ref } from 'vue'

import { authHeader } from '../api.js'

// Proxied through our server (caching + rate limits)
const OSRM_BASE = '/api/geo/route'

export function useRouting() {
  const route = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function getRoute(from, to) {
    loading.value = true
    error.value = null
    route.value = null

    try {
      const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`
      const response = await fetch(url, { headers: authHeader() })

      if (!response.ok) throw new Error('Routing failed')

      const data = await response.json()

      if (data.code !== 'Ok' || !data.routes.length) {
        throw new Error('No route found')
      }

      const r = data.routes[0]
      route.value = {
        coordinates: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: r.distance,
        duration: r.duration,
        steps: r.legs[0].steps.map(s => ({
          instruction: s.maneuver.type.replace(/_/g, ' '),
          distance: s.distance,
          duration: s.duration,
          name: s.name || '',
        })),
      }

      return route.value
    } catch (err) {
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  function clearRoute() {
    route.value = null
    error.value = null
  }

  function formatDistance(meters) {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`
    }
    return `${Math.round(meters)} m`
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}min`
    }
    return `${minutes} min`
  }

  return {
    route,
    loading,
    error,
    getRoute,
    clearRoute,
    formatDistance,
    formatDuration,
  }
}
