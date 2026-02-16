import { ref } from 'vue'

const OVERPASS_API = 'https://overpass-api.de/api/interpreter'

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

    const query = `
      [out:json][timeout:15];
      (
        node["amenity"~"restaurant|bar|cafe|pub|fast_food|biergarten|food_court|ice_cream|bakery|nightclub"](${south},${west},${north},${east});
      );
      out body 80;
    `

    try {
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
