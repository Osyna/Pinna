import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch } from 'vue'
import { api } from '../api.js'
import { showToast } from '../composables/useToast'
import { DEFAULT_CATEGORIES } from '../categoryIcons'

export const ICON_TO_CATEGORY = {
  restaurant: 'restaurant',
  bar: 'bar',
  cafe: 'cafe',
  nightclub: 'nightclub',
  bakery: 'bakery',
  generic: 'other',
  wine: 'bar',
  beer: 'bar',
  lodging: 'hotel',
  fastfood: 'fast-food',
  monument: 'culture',
  shopping: 'shopping',
  supermarket: 'shopping',
  fitness: 'other',
  parking: 'other',
  geocode: 'other',
}

function convertGeoJSONToPlaces(geojson) {
  return geojson.features.map((feature) => {
    if (!feature?.geometry?.coordinates) return null
    const { coordinates } = feature.geometry
    const props = feature.properties || {}

    // Google Maps Takeout ("Saved Places.json"): properties.location + google_maps_url
    if (props.google_maps_url || props.location) {
      const loc = props.location || {}
      return {
        name: loc.name || props.Title || 'Unknown',
        lat: coordinates[1],
        lng: coordinates[0],
        address: loc.address || '',
        category: 'other',
        notes: props.Comment || '',
        rating: 0,
        cuisine: 'None',
        tags: [],
        website: props.google_maps_url || '',
      }
    }

    // Mapstr / generic GeoJSON export
    const { name, address, icon, userComment, tags } = props
    return {
      name: name || 'Unknown',
      lat: coordinates[1],
      lng: coordinates[0],
      address: address || '',
      category: ICON_TO_CATEGORY[icon] || 'other',
      notes: userComment || '',
      rating: 0,
      cuisine: 'None',
      tags: Array.isArray(tags) ? tags.map(t => typeof t === 'string' ? t : t.name) : [],
    }
  }).filter(Boolean)
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  return lines.slice(1).map(line => {
    const values = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

function convertCSVToPlaces(rows) {
  return rows.filter(r => {
    const lat = parseFloat(r.latitude || r.lat || '')
    const lng = parseFloat(r.longitude || r.lng || r.lon || '')
    return !isNaN(lat) && !isNaN(lng)
  }).map(r => {
    const icon = r.icon || r.category || r.type || ''
    return {
      name: r.name || r.title || 'Unknown',
      lat: parseFloat(r.latitude || r.lat),
      lng: parseFloat(r.longitude || r.lng || r.lon),
      address: r.address || r.location || '',
      category: ICON_TO_CATEGORY[icon.toLowerCase()] || 'other',
      notes: r.usercomment || r.comment || r.notes || r.description || '',
      rating: 0,
      cuisine: 'None',
      tags: (r.tags || '').split(';').map(t => t.trim()).filter(Boolean),
    }
  })
}

function mergeGeoJSONWithCSV(geojsonPlaces, csvRows) {
  // Build a lookup from CSV by name (lowercased) for enrichment
  const csvByName = {}
  for (const r of csvRows) {
    const key = (r.name || r.title || '').toLowerCase().trim()
    if (key) csvByName[key] = r
  }

  return geojsonPlaces.map(place => {
    const csvRow = csvByName[place.name.toLowerCase().trim()]
    if (!csvRow) return place

    // Enrich with CSV data that GeoJSON might not have
    const status = (csvRow.status || csvRow.state || '').toLowerCase()
    if (status && !place.tags.includes(status)) {
      place.tags = [...place.tags, status]
    }
    if (!place.notes && (csvRow.usercomment || csvRow.comment || csvRow.notes || csvRow.description)) {
      place.notes = csvRow.usercomment || csvRow.comment || csvRow.notes || csvRow.description
    }
    return place
  })
}

const CUISINE_TYPES = [
  'None',
  'African',
  'American',
  'Asian',
  'Brazilian',
  'Caribbean',
  'Chinese',
  'Ethiopian',
  'French',
  'Greek',
  'Indian',
  'Italian',
  'Japanese',
  'Korean',
  'Lebanese',
  'Mediterranean',
  'Mexican',
  'Moroccan',
  'Peruvian',
  'Spanish',
  'Thai',
  'Turkish',
  'Vegan',
  'Vegetarian',
  'Vietnamese',
  'Other',
]

export const usePlacesStore = defineStore("pinna-places", () => {
  const places = shallowRef([])
  const placesVersion = ref(0)
  watch(places, () => { placesVersion.value++ })
  const trashedPlaces = shallowRef([])
  const categories = ref([...DEFAULT_CATEGORIES])
  const loaded = ref(false)
  const selectedPlaceId = ref(null)
  const filterCategory = ref(null)
  const filterCuisine = ref(null)
  const filterTag = ref(null)
  const filterMinRating = ref(0)
  const searchQuery = ref('')

  const allTags = computed(() => {
    const tagSet = new Set()
    places.value.forEach(p => {
      if (p.tags) p.tags.forEach(t => tagSet.add(t))
    })
    return [...tagSet].sort()
  })

  const filteredPlaces = computed(() => {
    let result = places.value
    if (filterCategory.value) {
      result = result.filter(p => p.category === filterCategory.value)
    }
    if (filterCuisine.value) {
      result = result.filter(p => p.cuisine === filterCuisine.value)
    }
    if (filterTag.value) {
      result = result.filter(p => p.tags && p.tags.includes(filterTag.value))
    }
    if (filterMinRating.value > 0) {
      result = result.filter(p => (p.rating || 0) >= filterMinRating.value)
    }
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.cuisine && p.cuisine.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      )
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })

  const selectedPlace = computed(() =>
    places.value.find(p => p.id === selectedPlaceId.value) || null
  )

  const placeCount = computed(() => places.value.length)

  const categoryCounts = computed(() => {
    const counts = {}
    places.value.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return counts
  })

  async function fetchPlaces() {
    const data = await api.get('/places')
    places.value = data.places
    loaded.value = true
  }

  async function fetchCategories() {
    const data = await api.get('/categories')
    if (data.categories && data.categories.length > 0) {
      categories.value = data.categories
    } else {
      categories.value = [...DEFAULT_CATEGORIES]
    }
  }

  async function saveCategories() {
    await api.put('/categories', { categories: categories.value })
  }

  async function addPlace({ name, lat, lng, address = '', category = 'other', notes = '', rating = 0, cuisine = 'None', tags = [], website = '' }) {
    const data = await api.post('/places', {
      name,
      lat,
      lng,
      address,
      category,
      notes,
      rating,
      cuisine,
      tags,
      website,
    })
    const place = data.place
    places.value = [place, ...places.value]
    selectedPlaceId.value = place.id
    return place
  }

  async function updatePlace(id, updates) {
    const data = await api.put(`/places/${id}`, updates)
    places.value = places.value.map(p => p.id === id ? data.place : p)
  }

  async function removePlace(id) {
    await api.delete(`/places/${id}`)
    const removed = places.value.find(p => p.id === id)
    places.value = places.value.filter(p => p.id !== id)
    if (removed) trashedPlaces.value = [{ ...removed, deletedAt: new Date().toISOString() }, ...trashedPlaces.value]
    if (selectedPlaceId.value === id) {
      selectedPlaceId.value = null
    }
    showToast('Moved to Recently Deleted', {
      type: 'success',
      action: { label: 'Undo', handler: () => restorePlace(id).catch(() => {}) },
    })
  }

  async function fetchTrash() {
    try {
      const data = await api.get('/places/trash/list')
      trashedPlaces.value = data.places
    } catch { /* trash is best-effort */ }
  }

  async function restorePlace(id) {
    await api.put(`/places/${id}/restore`, {})
    const p = trashedPlaces.value.find(t => t.id === id)
    trashedPlaces.value = trashedPlaces.value.filter(t => t.id !== id)
    if (p) {
      const { deletedAt, ...clean } = p
      places.value = [clean, ...places.value]
    }
    showToast('Place restored', { type: 'success' })
  }

  /* ── Lists (collections) ── */
  const lists = ref([])

  async function fetchLists() {
    try {
      const data = await api.get('/lists')
      lists.value = data.lists
    } catch { /* lists are best-effort */ }
  }

  async function createList(name) {
    const data = await api.post('/lists', { name })
    lists.value = [...lists.value, data.list]
    return data.list
  }

  async function deleteList(id) {
    await api.delete(`/lists/${id}`)
    lists.value = lists.value.filter(l => l.id !== id)
  }

  async function toggleListMembership(listId, placeId) {
    const list = lists.value.find(l => l.id === listId)
    if (!list) return
    if (list.placeIds.includes(placeId)) {
      await api.delete(`/lists/${listId}/places/${placeId}`)
      list.placeIds = list.placeIds.filter(id => id !== placeId)
    } else {
      await api.post(`/lists/${listId}/places`, { placeId })
      list.placeIds = [...list.placeIds, placeId]
    }
    lists.value = [...lists.value]
  }

  /* ── Bulk operations ── */
  async function bulkDelete(ids) {
    await Promise.all(ids.map(id => api.delete(`/places/${id}`)))
    const removed = places.value.filter(p => ids.includes(p.id))
    places.value = places.value.filter(p => !ids.includes(p.id))
    trashedPlaces.value = [
      ...removed.map(p => ({ ...p, deletedAt: new Date().toISOString() })),
      ...trashedPlaces.value,
    ]
    showToast(`${ids.length} places moved to Recently Deleted`, { type: 'success' })
  }

  async function bulkSetCategory(ids, category) {
    await Promise.all(ids.map(id => api.put(`/places/${id}`, { category })))
    places.value = places.value.map(p => ids.includes(p.id) ? { ...p, category } : p)
    showToast(`${ids.length} places re-categorized`, { type: 'success' })
  }

  async function purgePlace(id) {
    await api.delete(`/places/${id}/permanent`)
    trashedPlaces.value = trashedPlaces.value.filter(t => t.id !== id)
    showToast('Deleted forever', { type: 'success' })
  }

  function selectPlace(id) {
    selectedPlaceId.value = id
  }

  function clearSelection() {
    selectedPlaceId.value = null
  }

  function getCategoryById(id) {
    return categories.value.find(c => c.id === id) || categories.value[categories.value.length - 1]
  }

  function clearAllFilters() {
    filterCategory.value = null
    filterCuisine.value = null
    filterTag.value = null
    filterMinRating.value = 0
    searchQuery.value = ''
  }

  function exportPlaces() {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      places: places.value,
      categories: categories.value,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mappsly-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    showToast(`${places.value.length} places exported`, { type: 'success' })
    URL.revokeObjectURL(url)
  }

  async function importMapstrFiles(files) {
    let geojsonPlaces = []
    let csvRows = []

    for (const file of files) {
      const text = await file.text()
      const ext = file.name.split('.').pop().toLowerCase()

      if (ext === 'csv') {
        csvRows = parseCSV(text)
      } else {
        // JSON or GeoJSON
        try {
          const data = JSON.parse(text)
          if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
            geojsonPlaces = convertGeoJSONToPlaces(data)
          } else if (data.places && Array.isArray(data.places)) {
            // Mappsly's own export format
            geojsonPlaces = data.places.map(p => ({
              rating: 0, cuisine: 'None', tags: [], ...p,
            }))
          }
        } catch {
          return { count: 0, error: 'Invalid JSON file' }
        }
      }
    }

    // If only CSV, convert directly
    if (geojsonPlaces.length === 0 && csvRows.length > 0) {
      geojsonPlaces = convertCSVToPlaces(csvRows)
    }
    // If both, merge CSV data into GeoJSON places
    else if (geojsonPlaces.length > 0 && csvRows.length > 0) {
      geojsonPlaces = mergeGeoJSONWithCSV(geojsonPlaces, csvRows)
    }

    if (geojsonPlaces.length === 0) {
      showToast('No places found in files', { type: 'error' })
      return { count: 0, error: 'No places found in files' }
    }

    // Deduplicate against existing places by name+coordinates
    const existing = new Set(
      places.value.map(p => `${p.name.toLowerCase().trim()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`)
    )
    const newPlaces = geojsonPlaces.filter(p =>
      !existing.has(`${p.name.toLowerCase().trim()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`)
    )

    if (newPlaces.length === 0) {
      showToast('All places already exist', { type: 'info' })
      return { count: 0, error: null }
    }

    // Bulk import via API
    try {
      const data = await api.post('/places/import', { places: newPlaces })
      places.value = [...data.places, ...places.value]
      showToast(`${data.count} places imported!`, { type: 'success' })
      return { count: data.count, error: null }
    } catch {
      showToast('Import failed', { type: 'error' })
      return { count: 0, error: 'Server error during import' }
    }
  }

  return {
    places,
    categories,
    cuisineTypes: CUISINE_TYPES,
    loaded,
    selectedPlaceId,
    filterCategory,
    filterCuisine,
    filterTag,
    filterMinRating,
    searchQuery,
    allTags,
    filteredPlaces,
    selectedPlace,
    placeCount,
    categoryCounts,
    fetchPlaces,
    fetchCategories,
    saveCategories,
    addPlace,
    updatePlace,
    removePlace,
    placesVersion,
    trashedPlaces,
    lists,
    fetchLists,
    createList,
    deleteList,
    toggleListMembership,
    bulkDelete,
    bulkSetCategory,
    fetchTrash,
    restorePlace,
    purgePlace,
    selectPlace,
    clearSelection,
    getCategoryById,
    clearAllFilters,
    exportPlaces,
    importMapstrFiles,
  }
})
