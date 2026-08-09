<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, markRaw } from 'vue'
import maplibregl from 'maplibre-gl'
import { usePlacesStore } from '../stores/places'
import { useFriendsStore } from '../stores/friends'
import { useAuthStore } from '../stores/auth'

// Tune worker threads to match CPU cores
maplibregl.workerCount = navigator.hardwareConcurrency || 4
import { useGeocoding } from '../composables/useGeocoding'
import { useNearby } from '../composables/useNearby'
import { useUserLocation } from '../composables/useUserLocation'
import { useTheme } from '../composables/useTheme'
import { hapticTap } from '../composables/useHaptics'
import { ACCENT } from '../theme'
import { iconPathFor, categoryIconSvg, markerImageId, drawMarkerImage, amenityStyle, nearbyImageId } from '../categoryIcons'

const props = defineProps({
  splashFinished: Boolean
})

const emit = defineEmits(['place-select', 'show-detail', 'add-place', 'zoom-change'])
const store = usePlacesStore()
const friendsStore = useFriendsStore()
const authStore = useAuthStore()
const { reverseGeocode } = useGeocoding()
const { nearbyPlaces, loading: nearbyLoading, fetchNearby, clearNearby } = useNearby()
const { userLat, userLng, accuracy, locating, error: geoError, locate, startWatching } = useUserLocation()
const { theme } = useTheme()
// iconPathFor is used directly in the legend template

const mapContainer = ref(null)
const zoomPillRef = ref(null)
let map = null
let nearbyPopup = null
let pulseFrame = null

const showNearby = ref(false)
const nearbyCount = ref(0)
const showFriendPicker = ref(false)
const selectedFriendProfile = ref(null)
const friendAvatarError = ref(false)
const currentZoom = ref(2)
const currentLayer = ref('dark')
const showLegendPanel = ref(false)
const hiddenCats = ref(new Set())

const legendCategories = computed(() =>
  friendsStore.viewingFriendId ? (friendsStore.viewingFriendCategories || []) : store.categories
)

const legendCounts = computed(() => {
  const src = friendsStore.viewingFriendId ? friendsStore.viewingFriendPlaces : store.places
  const m = {}
  src.forEach(p => { m[p.category] = (m[p.category] || 0) + 1 })
  return m
})

function toggleCategoryVisibility(id) {
  const s = new Set(hiddenCats.value)
  s.has(id) ? s.delete(id) : s.add(id)
  hiddenCats.value = s
  renderMarkers()
}
const hasBuiltLegend = ref(false)

watch(() => props.splashFinished, (done) => {
  if (done) {
    // Mark as built after the 1.5s animation + delay
    setTimeout(() => {
      hasBuiltLegend.value = true
    }, 2500)
  }
})

/* ─── Long-press to add place ─── */
let longPressTimer = null
let longPressStartPos = null
let userLocationMarker = null

const AMENITY_TO_CATEGORY = {
  restaurant: 'restaurant', bar: 'bar', pub: 'bar', cafe: 'cafe',
  fast_food: 'fast-food', biergarten: 'bar', food_court: 'restaurant',
  ice_cream: 'cafe', bakery: 'bakery', nightclub: 'nightclub',
}

function mapCuisine(raw) {
  if (!raw) return 'None'
  const first = raw.split(';')[0].trim().toLowerCase()
  const m = {
    african:'African',american:'American',asian:'Asian',brazilian:'Brazilian',
    caribbean:'Caribbean',chinese:'Chinese',ethiopian:'Ethiopian',french:'French',
    greek:'Greek',indian:'Indian',italian:'Italian',japanese:'Japanese',
    korean:'Korean',lebanese:'Lebanese',mediterranean:'Mediterranean',mexican:'Mexican',
    moroccan:'Moroccan',peruvian:'Peruvian',spanish:'Spanish',thai:'Thai',
    turkish:'Turkish',vegan:'Vegan',vegetarian:'Vegetarian',vietnamese:'Vietnamese',
    pizza:'Italian',pasta:'Italian',sushi:'Japanese',burger:'American',
    kebab:'Turkish',tapas:'Spanish',ramen:'Japanese',pho:'Vietnamese',
    tacos:'Mexican',curry:'Indian',dim_sum:'Chinese',falafel:'Lebanese',
  }
  return m[first] || 'Other'
}

/* ─── Raster tile style specs ─── */
const GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'

const MAP_STYLES = {
  dark: {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      },
    },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles' }],
  },
  light: {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      },
    },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles' }],
  },
  streets: {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
      },
    },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles' }],
  },
  satellite: {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: '&copy; Esri',
      },
    },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles' }],
  },
}

const EMPTY_FC = { type: 'FeatureCollection', features: [] }

/* ─── Coordinate precision: 6 decimals ≈ 0.1m ─── */
function coord6(v) { return Math.round(v * 1e6) / 1e6 }

/* ─── Meters → pixels conversion ─── */
function metersToPixels(meters, lat, zoom) {
  const earthCircumference = 40075017
  const latRad = lat * Math.PI / 180
  const metersPerPixel = earthCircumference * Math.cos(latRad) / (256 * Math.pow(2, zoom))
  return meters / metersPerPixel
}

/* ─── Layer setup (called on load + after style switch) ─── */
function setupCustomLayers() {
  const nearbyColor = theme.value === 'light' ? '#0891b2' : '#22d3ee'
  // (The old country-border overlay from demotiles.maplibre.org was removed:
  // it doubled the basemap's own boundaries with aliased purple lines and
  // added an unreliable external tile dependency.)

  // Sources — places & nearby use clustering
  map.addSource('places', {
    type: 'geojson',
    data: EMPTY_FC,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 40,
  })
  map.addSource('nearby', {
    type: 'geojson',
    data: EMPTY_FC,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  })
  map.addSource('user-location', { type: 'geojson', data: EMPTY_FC })
  map.addSource('temp-pin', { type: 'geojson', data: EMPTY_FC })

  // User accuracy ring (bottom)
  map.addLayer({
    id: 'user-accuracy-ring',
    type: 'circle',
    source: 'user-location',
    filter: ['==', ['get', 'type'], 'ring'],
    paint: {
      'circle-radius': ['get', 'radiusPixels'],
      'circle-color': `${ACCENT}10`,
      'circle-stroke-width': 1,
      'circle-stroke-color': `${ACCENT}4D`,
    },
  })

  // ── Nearby clusters ──
  map.addLayer({
    id: 'nearby-clusters',
    type: 'circle',
    source: 'nearby',
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
      'circle-color': nearbyColor,
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255, 255, 255, 0.7)',
      'circle-opacity': 0.85,
    },
  })
  map.addLayer({
    id: 'nearby-cluster-count',
    type: 'symbol',
    source: 'nearby',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 11,
      'text-font': ['Open Sans Bold'],
    },
    paint: { 'text-color': '#ffffff' },
  })

  // Nearby individual markers (exclude clusters): dashed-ring icon discs —
  // same type colors as saved places, dotted outline = "not saved yet"
  map.addLayer({
    id: 'nearby-circles',
    type: 'symbol',
    source: 'nearby',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'iconId'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })

  // ── Places clusters ──
  map.addLayer({
    id: 'places-clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
      'circle-color': ACCENT,
      'circle-stroke-width': 0,
      'circle-opacity': 1,
    },
  })
  map.addLayer({
    id: 'places-cluster-count',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-size': 13,
      'text-font': ['Open Sans Bold'],
    },
    paint: { 'text-color': '#ffffff' },
  })

  // Places (normal — exclude clusters): category icon markers so that
  // color is never the only channel encoding a category
  map.addLayer({
    id: 'places-circles',
    type: 'symbol',
    source: 'places',
    filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'selected'], true]],
    layout: {
      'icon-image': ['get', 'iconId'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 12, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })

  // Places (selected glow — behind selected icon, exclude clusters)
  map.addLayer({
    id: 'places-selected-glow',
    type: 'circle',
    source: 'places',
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
    paint: {
      'circle-radius': 22,
      'circle-color': '#ffffff',
      'circle-opacity': 0,
      'circle-stroke-width': 4,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.3,
    },
  })

  // Places (selected dot — exclude clusters)
  map.addLayer({
    id: 'places-selected',
    type: 'symbol',
    source: 'places',
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
    layout: {
      'icon-image': ['get', 'iconId'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 12, 1.25],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  })

  // Temp pin (search result preview)
  map.addLayer({
    id: 'temp-pin-glow',
    type: 'circle',
    source: 'temp-pin',
    paint: {
      'circle-radius': 18,
      'circle-color': 'transparent',
      'circle-stroke-width': 3,
      'circle-stroke-color': ACCENT,
      'circle-stroke-opacity': 0.3,
    },
  })
  map.addLayer({
    id: 'temp-pin-dot',
    type: 'circle',
    source: 'temp-pin',
    paint: {
      'circle-radius': 9,
      'circle-color': ACCENT,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  })

}

/* ─── Click + cursor handlers ─── */
function setupClickHandlers() {
  // Cluster click → zoom to expand
  function handleClusterClick(sourceName, e) {
    const coords = e.features[0].geometry.coordinates.slice()
    const clusterId = e.features[0].properties.cluster_id
    const src = map.getSource(sourceName)
    const fallbackZoom = Math.min((map.getZoom() || 2) + 3, 18)
    src.getClusterExpansionZoom(clusterId).then(zoom => {
      map.flyTo({ center: coords, zoom: zoom ?? fallbackZoom, duration: 500, padding: FLY_PADDING })
    }).catch(() => {
      map.flyTo({ center: coords, zoom: fallbackZoom, duration: 500, padding: FLY_PADDING })
    })
  }
  map.on('click', 'places-clusters', (e) => handleClusterClick('places', e))
  map.on('click', 'places-cluster-count', (e) => handleClusterClick('places', e))
  map.on('click', 'nearby-clusters', (e) => handleClusterClick('nearby', e))
  map.on('click', 'nearby-cluster-count', (e) => handleClusterClick('nearby', e))

  // Places click — when several markers overlap at this spot, offer a chooser
  function handlePlaceClick(e) {
    const pad = 14
    const bbox = [
      [e.point.x - pad, e.point.y - pad],
      [e.point.x + pad, e.point.y + pad],
    ]
    const hits = map.queryRenderedFeatures(bbox, { layers: ['places-circles', 'places-selected'] })
    const ids = [...new Set(hits.map(f => f.properties.id))]
    const placesSource = friendsStore.viewingFriendId ? friendsStore.viewingFriendPlaces : store.places

    if (ids.length > 1) {
      showPlaceChooser(ids.map(id => placesSource.find(p => p.id === id)).filter(Boolean), e.lngLat)
      return
    }
    const placeId = e.features[0].properties.id
    store.selectPlace(placeId)
    const place = placesSource.find(p => p.id === placeId)
    if (place) emit('show-detail', place)
  }
  map.on('click', 'places-circles', handlePlaceClick)
  map.on('click', 'places-selected', handlePlaceClick)

  // Nearby click — show popup
  map.on('click', 'nearby-circles', (e) => {
    const feature = e.features[0]
    const coords = feature.geometry.coordinates.slice()
    const props = feature.properties
    const amenityLabel = (props.amenity || '').replace(/_/g, ' ')
    const cuisineDisplay = props.cuisine ? props.cuisine.split(';')[0].trim() : ''
    const popupId = `nearby-${props.osmId || props.lat}`

    const html = `
      <div class="place-preview nearby">
        <div class="pp-header">
          <span class="pp-cat-icon nearby" style="color:${amenityStyle(props.amenity).color};border-color:${amenityStyle(props.amenity).color}">${categoryIconSvg(amenityStyle(props.amenity).icon, { size: 13 })}</span>
          <span class="pp-name">${props.name}</span>
        </div>
        <div class="pp-meta">
          ${cuisineDisplay ? `<span class="pp-cuisine">${cuisineDisplay}</span>` : ''}
          <span class="pp-type">${amenityLabel}</span>
        </div>
        ${props.address ? `<div class="pp-addr">${props.address}</div>` : ''}
        <button id="${popupId}" class="pp-save-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Save place
        </button>
      </div>
    `

    nearbyPopup.setLngLat(coords).setHTML(html).addTo(map)

    setTimeout(() => {
      const btn = document.getElementById(popupId)
      if (btn) btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const category = AMENITY_TO_CATEGORY[props.amenity] || 'other'
        const tags = []
        if (props.amenity) tags.push(props.amenity.replace(/_/g, ' '))
        if (props.cuisine) props.cuisine.split(';').forEach(c => { const t = c.trim().toLowerCase(); if (t && !tags.includes(t)) tags.push(t) })
        emit('add-place', {
          lat: parseFloat(props.lat), lng: parseFloat(props.lng),
          address: props.address || '', name: props.name,
          category, cuisine: mapCuisine(props.cuisine), tags,
        })
        nearbyPopup.remove()
      })
    }, 0)
  })

  // Temp pin click — reopen popup without re-flying
  map.on('click', 'temp-pin-dot', () => {
    if (tempPinData) {
      showTempPin(tempPinData, { skipFly: true })
    }
  })

  // Click outside any feature — close popup
  map.on('click', (e) => {
    const hitLayers = ['nearby-circles', 'temp-pin-dot', 'places-circles', 'places-selected', 'places-clusters', 'places-cluster-count', 'nearby-clusters', 'nearby-cluster-count']
    const features = map.queryRenderedFeatures(e.point, { layers: hitLayers.filter(l => map.getLayer(l)) })
    if (features.length === 0) {
      nearbyPopup.remove()
    }
  })

  // Cursor changes
  for (const layer of ['places-circles', 'places-selected', 'nearby-circles', 'places-clusters', 'places-cluster-count', 'nearby-clusters', 'nearby-cluster-count', 'temp-pin-dot']) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
  }
}

/* ─── Render helpers ─── */
function renderMarkers() {
  if (!map || !map.getSource('places')) return

  const isViewingFriend = !!friendsStore.viewingFriendId
  const placesToRender = (isViewingFriend ? friendsStore.viewingFriendPlaces : store.places)
    .filter(place => !hiddenCats.value.has(place.category))

  const features = placesToRender.map(place => {
    const cat = isViewingFriend
      ? friendsStore.getCategoryById(place.category)
      : store.getCategoryById(place.category)
    const isSelected = store.selectedPlaceId === place.id
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coord6(place.lng), coord6(place.lat)] },
      properties: { id: place.id, color: cat.color, iconId: markerImageId(cat), selected: isSelected },
    }
  })
  map.getSource('places').setData({ type: 'FeatureCollection', features })

  // Start/stop pulse based on selection
  if (store.selectedPlaceId) startPulse()
  else stopPulse()
}

function renderNearbyMarkers() {
  if (!map || !map.getSource('nearby')) return
  if (!showNearby.value) {
    map.getSource('nearby').setData(EMPTY_FC)
    nearbyCount.value = 0
    return
  }
  const savedCoords = new Set(store.places.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`))
  const features = nearbyPlaces.value
    .filter(place => !savedCoords.has(`${place.lat.toFixed(5)},${place.lng.toFixed(5)}`))
    .map(place => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coord6(place.lng), coord6(place.lat)] },
      properties: {
        osmId: place.osmId || '',
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        amenity: place.amenity,
        iconId: nearbyImageId(place.amenity),
        cuisine: place.cuisine || '',
        address: place.address || '',
      },
    }))
  map.getSource('nearby').setData({ type: 'FeatureCollection', features })
  nearbyCount.value = features.length
}

function updateUserMarker() {
  if (!map || !map.getSource('user-location') || userLat.value == null) return
  const r = Math.min(Math.max(accuracy.value || 30, 15), 100)
  const radiusPixels = metersToPixels(r, userLat.value, map.getZoom())
  const features = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [userLng.value, userLat.value] },
      properties: { type: 'ring', radiusPixels },
    },
  ]
  map.getSource('user-location').setData({ type: 'FeatureCollection', features })

  // HTML marker for user position (navigation arrow)
  if (!userLocationMarker) {
    const el = createUserLocationElement()
    userLocationMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([userLng.value, userLat.value])
      .addTo(map)
  } else {
    userLocationMarker.setLngLat([userLng.value, userLat.value])
  }
}

/* ─── Pulse animation (rAF) ─── */
function startPulse() {
  if (pulseFrame) return
  const start = performance.now()
  function animate(now) {
    if (!map || !map.getLayer('places-selected-glow')) { pulseFrame = null; return }
    const t = ((now - start) % 1800) / 1800
    const ease = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
    map.setPaintProperty('places-selected-glow', 'circle-stroke-width', 4 + ease * 4)
    map.setPaintProperty('places-selected-glow', 'circle-stroke-opacity', 0.3 - ease * 0.2)
    pulseFrame = requestAnimationFrame(animate)
  }
  pulseFrame = requestAnimationFrame(animate)
}

function stopPulse() {
  if (pulseFrame) {
    cancelAnimationFrame(pulseFrame)
    pulseFrame = null
  }
}

/* ─── User location HTML marker (navigation arrow) ─── */
function createUserLocationElement() {
  const el = document.createElement('div')
  el.className = 'user-loc-marker'
  el.innerHTML = `
    <div class="user-loc-ring"></div>
    <svg width="22" height="22" viewBox="0 0 22 22" class="user-loc-arrow">
      <path d="M11 1 L5 18 L11 13 L17 18 Z" fill="${ACCENT}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `
  return el
}

/* ─── Long-press to add place ─── */
function setupLongPress() {
  const canvas = map.getCanvas()

  function startLongPress(x, y) {
    clearTimeout(longPressTimer)
    longPressStartPos = { x, y }
    longPressTimer = setTimeout(async () => {
      if (!map || friendsStore.viewingFriendId) return
      hapticTap()
      const lngLat = map.unproject([x, y])
      const lat = lngLat.lat
      const lng = lngLat.lng
      const result = await reverseGeocode(lat, lng)
      const address = result?.display_name || ''
      const name = result?.display_name?.split(',')[0] || ''
      emit('add-place', { lat, lng, address, name })
    }, 600)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  function onMove(x, y) {
    if (!longPressStartPos) return
    const dx = x - longPressStartPos.x
    const dy = y - longPressStartPos.y
    if (Math.sqrt(dx * dx + dy * dy) > 10) cancelLongPress()
  }

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    startLongPress(touch.clientX - canvas.getBoundingClientRect().left, touch.clientY - canvas.getBoundingClientRect().top)
  }, { passive: true })

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    onMove(touch.clientX - canvas.getBoundingClientRect().left, touch.clientY - canvas.getBoundingClientRect().top)
  }, { passive: true })

  canvas.addEventListener('touchend', cancelLongPress, { passive: true })
  canvas.addEventListener('touchcancel', cancelLongPress, { passive: true })

  // Desktop: right-click or long mousedown
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    startLongPress(e.offsetX, e.offsetY)
  })
  canvas.addEventListener('mousemove', (e) => onMove(e.offsetX, e.offsetY))
  canvas.addEventListener('mouseup', cancelLongPress)
  canvas.addEventListener('mouseleave', cancelLongPress)
}

/* ─── Drag-to-zoom on zoom pill (mobile) ─── */
let zoomDragStartY = null
let zoomDragAccum = 0
const ZOOM_DRAG_PX_PER_LEVEL = 60 // pixels of drag per zoom level

function setupZoomDrag() {
  const el = zoomPillRef.value
  if (!el) return

  el.addEventListener('touchstart', (e) => {
    if (!map) return
    zoomDragStartY = e.touches[0].clientY
    zoomDragAccum = 0
    e.preventDefault()
  }, { passive: false })

  el.addEventListener('touchmove', (e) => {
    if (zoomDragStartY == null || !map) return
    e.preventDefault()
    const y = e.touches[0].clientY
    const delta = zoomDragStartY - y // positive = dragging up = zoom in
    zoomDragStartY = y
    zoomDragAccum += delta

    while (zoomDragAccum >= ZOOM_DRAG_PX_PER_LEVEL) {
      map.zoomIn({ duration: 100 })
      zoomDragAccum -= ZOOM_DRAG_PX_PER_LEVEL
    }
    while (zoomDragAccum <= -ZOOM_DRAG_PX_PER_LEVEL) {
      map.zoomOut({ duration: 100 })
      zoomDragAccum += ZOOM_DRAG_PX_PER_LEVEL
    }
  }, { passive: false })

  el.addEventListener('touchend', () => { zoomDragStartY = null; zoomDragAccum = 0 }, { passive: true })
  el.addEventListener('touchcancel', () => { zoomDragStartY = null; zoomDragAccum = 0 }, { passive: true })
}

/* ─── Tile switching ─── */
function switchTileLayer(name) {
  currentLayer.value = name
  const restoreLayers = () => {
    setupCustomLayers()
    setupClickHandlers()
    renderMarkers()
    if (showNearby.value) renderNearbyMarkers()
    updateUserMarker()
    if (tempPinData) showTempPin(tempPinData)
    setupLongPress()
  }
  map.once('style.load', restoreLayers)
  map.setStyle(MAP_STYLES[name])
}

/* ─── Update layer colors without tile switch ─── */
function updateLayerColors() {
  if (!map) return
  const nearbyColor = theme.value === 'light' ? '#0891b2' : '#22d3ee'
  if (map.getLayer('nearby-clusters')) {
    map.setPaintProperty('nearby-clusters', 'circle-color', nearbyColor)
  }
}

/* ─── Public API ─── */
// Padding to visually center between search bar and bottom tabs
const FLY_PADDING = { top: 80, bottom: 80, left: 0, right: 0 }

function flyTo(lat, lng, zoom = 15) {
  if (!map) return
  map.resize()
  const cur = map.getZoom()
  const target = Math.min(zoom, Math.max(cur, 15))
  map.flyTo({ center: [lng, lat], zoom: target, duration: 800, padding: FLY_PADDING })
}

function smartFlyTo(lat, lng) {
  if (!map) return
  map.resize()
  const cur = map.getZoom()
  const target = cur >= 14 ? cur : 15
  map.flyTo({ center: [lng, lat], zoom: target, duration: 800, padding: FLY_PADDING })
}


function getCenter() {
  if (!map) return null
  const c = map.getCenter()
  return { lat: c.lat, lng: c.lng }
}

function getBounds() {
  if (!map) return null
  const b = map.getBounds()
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }
}

const nearbyEmpty = ref(false)
const nearbyFailed = ref(false)

async function toggleNearby() {
  if (showNearby.value) {
    showNearby.value = false
    nearbyEmpty.value = false
    nearbyFailed.value = false
    if (map.getSource('nearby')) {
      map.getSource('nearby').setData(EMPTY_FC)
    }
    nearbyCount.value = 0
    clearNearby()
    return
  }
  showNearby.value = true
  nearbyEmpty.value = false
  nearbyFailed.value = false
  await doFetchNearby()
}

async function doFetchNearby() {
  nearbyFailed.value = false
  nearbyEmpty.value = false
  const results = await fetchNearby(map.getBounds())
  if (!showNearby.value) return
  if (results === null) {
    nearbyFailed.value = true
  } else {
    renderNearbyMarkers()
    if (nearbyCount.value === 0) nearbyEmpty.value = true
  }
}

async function retryNearby() {
  nearbyFailed.value = false
  await doFetchNearby()
}

async function locateMe() {
  try {
    const pos = await locate()
    startWatching()
    updateUserMarker()
    const targetZoom = Math.max(map.getZoom(), 14)
    map.flyTo({ center: [pos.lng, pos.lat], zoom: targetZoom, duration: 1200 })
  } catch { /* error handled in composable */ }
}

/* ─── Temp pin for search result preview ─── */
let tempPinData = null

function showTempPin({ lat, lng, name, address, website }, { skipFly = false } = {}) {
  if (!map || !map.getSource('temp-pin')) return
  tempPinData = { lat, lng, name, address, website }
  map.getSource('temp-pin').setData({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { name, address },
    }],
  })

  const popupId = 'temp-pin-add'
  const html = `
    <div class="place-preview nearby">
      <div class="pp-header">
        <span class="pp-nearby-dot"></span>
        <span class="pp-name">${name}</span>
      </div>
      ${address ? `<div class="pp-addr">${address}</div>` : ''}
      <button id="${popupId}" class="pp-save-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Save place
      </button>
    </div>
  `
  nearbyPopup.setLngLat([lng, lat]).setHTML(html).addTo(map)

  setTimeout(() => {
    const btn = document.getElementById(popupId)
    if (btn) btn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      emit('add-place', { lat, lng, address: address || '', name, website: website || '' })
      clearTempPin()
    })
  }, 0)

  if (!skipFly) {
    // Resize first in case map was hidden (tab switch), then fly
    map.resize()
    const targetZoom = Math.max(map.getZoom(), 15)
    map.flyTo({ center: [lng, lat], zoom: targetZoom, duration: 800, padding: FLY_PADDING })
  }
}

function clearTempPin() {
  tempPinData = null
  if (map && map.getSource('temp-pin')) {
    map.getSource('temp-pin').setData(EMPTY_FC)
  }
  nearbyPopup.remove()
}

function showFriendProfile(friend) {
  showFriendPicker.value = false
  selectedFriendProfile.value = friend
  friendAvatarError.value = false
}

async function viewFriendPlaces(friendId) {
  selectedFriendProfile.value = null
  await friendsStore.viewFriendPlaces(friendId)
  if (friendsStore.viewingFriendPlaces.length && map) {
    const first = friendsStore.viewingFriendPlaces[0]
    map.flyTo({ center: [first.lng, first.lat], zoom: 12, duration: 800, padding: FLY_PADDING })
  }
}

/* Several places share (almost) the same spot: let the user pick one */
function showPlaceChooser(places, lngLat) {
  if (!map || !places.length) return
  const getCatFn = friendsStore.viewingFriendId
    ? friendsStore.getCategoryById
    : store.getCategoryById
  const rows = places.map(p => {
    const cat = getCatFn(p.category)
    return `<button class="pc-row" data-place-id="${p.id}">
      <span class="pc-icon" style="background:${(cat?.color || '#8E8E93')}22;color:${cat?.color || '#8E8E93'}">${categoryIconSvg(cat?.icon, { size: 13 })}</span>
      <span class="pc-name">${p.name}</span>
    </button>`
  }).join('')
  const html = `<div class="place-chooser"><div class="pc-title">${places.length} places here</div>${rows}</div>`
  nearbyPopup.setLngLat(lngLat).setHTML(html).addTo(map)
  const el = nearbyPopup.getElement()
  el.querySelectorAll('.pc-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const place = places.find(p => p.id === btn.dataset.placeId)
      nearbyPopup.remove()
      if (place) {
        store.selectPlace(place.id)
        emit('show-detail', place)
      }
    })
  })
}

function showPlacePreview(place) {
  if (!map) return
  const cat = friendsStore.viewingFriendId ? friendsStore.getCategoryById(place.category) : store.getCategoryById(place.category)
  const catColor = cat?.color || ACCENT
  const catName = cat?.name || ''
  const stars = place.rating > 0 ? '<div class="pp-stars">' + '\u2605'.repeat(place.rating) + '\u2606'.repeat(5 - place.rating) + '</div>' : ''
  const cuisine = (place.cuisine && place.cuisine !== 'None') ? `<span class="pp-cuisine">${place.cuisine}</span>` : ''
  const addr = place.address ? `<div class="pp-addr">${place.address}</div>` : ''
  const tags = (place.tags && place.tags.length) ? `<div class="pp-tags">${place.tags.slice(0, 3).map(t => `<span class="pp-tag">${t}</span>`).join('')}</div>` : ''

  const html = `
    <div class="place-preview">
      <div class="pp-header">
        <span class="pp-cat-icon" style="color:${catColor}">${categoryIconSvg(cat?.icon, { size: 14 })}</span>
        <span class="pp-name">${place.name}</span>
      </div>
      <div class="pp-meta">
        ${cuisine}
        <span class="pp-cat" style="background:${catColor}20;color:${catColor}">${catName}</span>
      </div>
      ${stars}
      ${addr}
      ${tags}
    </div>
  `
  nearbyPopup.setLngLat([place.lng, place.lat]).setHTML(html).addTo(map)
}

defineExpose({ flyTo, smartFlyTo, getCenter, getBounds, toggleNearby, locateMe, showTempPin, clearTempPin, showPlacePreview })

/* ─── Lifecycle ─── */
onMounted(() => {
  const initialStyle = theme.value === 'light' ? 'light' : 'dark'

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: MAP_STYLES[initialStyle],
    center: [0, 30],
    zoom: 2,
    validateStyle: false,
  })
  map = markRaw(map)
  currentLayer.value = initialStyle

  nearbyPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '250px' })
  setupZoomDrag()

  // Category marker icons are generated lazily (and re-generated after every
  // style switch, which wipes images): white disc + ink outline + colored icon.
  map.on('styleimagemissing', (e) => {
    if (map.hasImage(e.id)) return
    if (e.id.startsWith('cat-marker|')) {
      const [, icon, color] = e.id.split('|')
      const { imageData, pixelRatio } = drawMarkerImage(icon, color)
      map.addImage(e.id, imageData, { pixelRatio })
    } else if (e.id.startsWith('nearby-marker|')) {
      const [, icon, color] = e.id.split('|')
      const { imageData, pixelRatio } = drawMarkerImage(icon, color, { size: 30, dashed: true })
      map.addImage(e.id, imageData, { pixelRatio })
    }
  })

  map.on('load', () => {
    setupCustomLayers()
    setupClickHandlers()
    setupLongPress()
    // Pre-generate marker images for known categories (no first-render pop-in)
    store.categories.forEach(cat => {
      const id = markerImageId(cat)
      if (!map.hasImage(id)) {
        const { imageData, pixelRatio } = drawMarkerImage(cat.icon, cat.color)
        map.addImage(id, imageData, { pixelRatio })
      }
    })
    renderMarkers()
  })

  map.on('zoomend', () => {
    currentZoom.value = map.getZoom()
    emit('zoom-change', currentZoom.value)
    updateUserMarker()
  })

  map.on('moveend', () => {
    emit('zoom-change', map.getZoom())
  })
})

onBeforeUnmount(() => {
  stopPulse()
  clearTimeout(longPressTimer)
  if (userLocationMarker) { userLocationMarker.remove(); userLocationMarker = null }
  if (nearbyPopup) nearbyPopup.remove()
  if (map) map.remove()
})

/* ─── Watchers ─── */
watch(() => [store.placesVersion, store.selectedPlaceId], () => renderMarkers())
watch(() => [friendsStore.viewingFriendPlaces, friendsStore.viewingFriendId], () => renderMarkers(), { deep: true })
watch(nearbyPlaces, () => { if (showNearby.value) renderNearbyMarkers() })
watch([userLat, userLng], () => updateUserMarker())
watch(theme, (newTheme) => {
  if (currentLayer.value === 'dark' || currentLayer.value === 'light') {
    switchTileLayer(newTheme === 'light' ? 'light' : 'dark')
  } else {
    updateLayerColors()
  }
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map-container"></div>

    <!-- Geo error toast -->
    <transition name="toast">
      <div v-if="geoError" class="geo-toast">{{ geoError }}</div>
    </transition>

    <!-- Nearby pill (unified: find / loading / results / empty / error) -->
    <transition name="toast">
      <!-- Loading -->
      <div v-if="showNearby && nearbyLoading" class="nearby-pill loading" key="loading">
        <div class="pill-spinner"></div>
        <span>Searching nearby...</span>
      </div>
      <!-- Error / retry -->
      <button v-else-if="showNearby && nearbyFailed" class="nearby-pill error" key="error" @click="retryNearby">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
        </svg>
        <span>Failed — tap to retry</span>
        <span class="pill-close" @click.stop="toggleNearby">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </span>
      </button>
      <!-- No results -->
      <div v-else-if="showNearby && nearbyEmpty" class="nearby-pill empty" key="empty">
        <span>No places found nearby</span>
        <span class="pill-close" @click="toggleNearby">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </span>
      </div>
      <!-- Results -->
      <button v-else-if="showNearby && nearbyCount > 0" class="nearby-pill active" key="results" @click="toggleNearby">
        <span class="pill-dot"></span>
        <span>{{ nearbyCount }} places nearby</span>
        <span class="pill-close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </span>
      </button>
      <!-- Find button -->
      <button v-else-if="currentZoom >= 12 && !showNearby" class="nearby-pill" key="find" @click="toggleNearby">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="4"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6m-3-3h6"/>
        </svg>
        <span>Find in this area</span>
      </button>
    </transition>

    <!-- Bottom-left controls: layer switcher -->
    <div class="bottom-controls" :class="{ 'build-anim build-anim--slide build-anim--delay-2': splashFinished }">
      <div class="layer-sw">
        <button :class="['layer-btn', { active: currentLayer === 'dark' || currentLayer === 'light' }]"
          @click="switchTileLayer(theme === 'light' ? 'light' : 'dark')">
          Default
        </button>
        <button :class="['layer-btn', { active: currentLayer === 'streets' }]"
          @click="switchTileLayer('streets')">
          Streets
        </button>
        <button :class="['layer-btn', { active: currentLayer === 'satellite' }]"
          @click="switchTileLayer('satellite')">
          Satellite
        </button>
      </div>
    </div>

    <!-- Friend viewing indicator -->
    <transition name="toast">
      <div v-if="friendsStore.viewingFriendId" class="friend-banner">
        <div class="friend-banner-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <span>{{ friendsStore.viewingFriendInfo?.name || 'Friend' }}'s map</span>
          <span class="friend-banner-count">{{ friendsStore.viewingFriendPlaces.length }}</span>
        </div>
        <button class="friend-banner-close" @click="friendsStore.clearFriendView()" title="Back to my map">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </transition>

    <!-- Right-side controls — vertically centered -->
    <div class="right-controls" :class="{ 'build-anim build-anim--slide-right build-anim--delay-3': splashFinished }">
      <button :class="['rc-btn', { active: locating || userLat != null }]" @click="locateMe" title="My location" aria-label="My location">
        <svg v-if="!locating" width="18" height="18" viewBox="0 0 24 24" fill="none"
          :stroke="userLat != null ? 'var(--accent)' : 'currentColor'" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3m-10-10h3m14 0h3"/>
        </svg>
        <div v-else class="btn-spin"></div>
      </button>
      <div ref="zoomPillRef" class="rc-zoom-pill">
        <button class="rc-zoom-btn" @click="map && map.zoomIn({ duration: 300 })" title="Zoom in" aria-label="Zoom in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <div class="rc-zoom-divider"></div>
        <button class="rc-zoom-btn" @click="map && map.zoomOut({ duration: 300 })" title="Zoom out" aria-label="Zoom out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      <button
        v-if="!friendsStore.viewingFriendId && friendsStore.friends.length > 0"
        class="rc-btn"
        aria-label="View a friend's map" @click="showFriendPicker = !showFriendPicker"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/>
          <path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </button>
    </div>

    <!-- Friend picker dropdown -->
    <div v-if="showFriendPicker" class="friend-picker-overlay" @click.self="showFriendPicker = false">
      <div class="friend-picker">
        <div class="friend-picker-title">View friend's places</div>
        <button
          v-for="f in friendsStore.friends" :key="f.id"
          class="friend-picker-item"
          @click="showFriendProfile(f)"
        >
          <div class="friend-picker-avatar">{{ (f.name || '?').charAt(0).toUpperCase() }}</div>
          <div class="friend-picker-info">
            <span class="friend-picker-name">{{ f.name || 'User' }}</span>
            <span class="friend-picker-handle">#{{ f.handle }}</span>
          </div>
          <span class="friend-picker-count">{{ f.placeCount }}</span>
        </button>
      </div>
    </div>

    <!-- Friend profile card -->
    <div v-if="selectedFriendProfile" class="friend-profile-overlay" @click.self="selectedFriendProfile = null">
      <div class="friend-profile-card">
        <button class="friend-profile-close" @click="selectedFriendProfile = null">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="friend-profile-hero">
          <div class="friend-profile-avatar">
            <img
              v-if="!friendAvatarError"
              :src="authStore.getAvatarUrl(selectedFriendProfile.id)"
              class="friend-profile-avatar-img"
              @error="friendAvatarError = true"
            />
            <span v-else class="friend-profile-avatar-initial">{{ (selectedFriendProfile.name || '?').charAt(0).toUpperCase() }}</span>
          </div>
          <h3 class="friend-profile-name">{{ selectedFriendProfile.name || 'User' }}</h3>
          <span class="friend-profile-handle">#{{ selectedFriendProfile.handle }}</span>
        </div>
        <div class="friend-profile-details">
          <div v-if="selectedFriendProfile.country" class="friend-profile-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{{ selectedFriendProfile.country }}</span>
          </div>
          <div v-if="selectedFriendProfile.bio" class="friend-profile-bio">
            {{ selectedFriendProfile.bio }}
          </div>
          <div v-if="selectedFriendProfile.favoriteCuisines && selectedFriendProfile.favoriteCuisines.length" class="friend-profile-cuisines">
            <span v-for="c in selectedFriendProfile.favoriteCuisines" :key="c" class="friend-profile-cuisine-chip">{{ c }}</span>
          </div>
          <div class="friend-profile-stat">
            <span class="friend-profile-stat-num">{{ selectedFriendProfile.placeCount }}</span>
            <span class="friend-profile-stat-label">places saved</span>
          </div>
        </div>
        <button class="friend-profile-view-btn" @click="viewFriendPlaces(selectedFriendProfile.id)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          View their places
        </button>
      </div>
    </div>

    <!-- Pin types: legend button + panel -->
    <button
      class="legend-fab" aria-label="Pin types legend"
      :class="{ 'build-anim build-anim--drop build-anim--delay-1': splashFinished && !hasBuiltLegend }"
      title="Pin types"
      @click="showLegendPanel = !showLegendPanel"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 21 8l-9 5-9-5 9-5Z"/><path d="M3 14l9 5 9-5"/>
      </svg>
    </button>

    <div v-if="showLegendPanel" class="legend-card">
      <div class="legend-card-head">
        <span>Pin types</span>
        <button @click="showLegendPanel = false">Done</button>
      </div>
      <div class="legend-grid">
        <button
          v-for="cat in legendCategories" :key="cat.id"
          :class="['legend-chip', { off: hiddenCats.has(cat.id) }]"
          :style="{ background: cat.color + '1f' }"
          @click="toggleCategoryVisibility(cat.id)"
        >
          <span class="legend-chip-icon" :style="{ color: cat.color }">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
              <path :d="iconPathFor(cat.icon)" />
            </svg>
          </span>
          <span class="legend-chip-name">{{ cat.name }}</span>
          <span class="legend-chip-count">{{ legendCounts[cat.id] || 0 }}</span>
        </button>
      </div>
    </div>

    <!-- Hidden overlay for closing when panel is open -->
    <div v-if="showLegendPanel" class="legend-panel-overlay" @click="showLegendPanel = false"></div>

  </div>
</template>

<style scoped lang="scss">
.map-wrapper { width: 100%; height: 100%; position: absolute; inset: 0; z-index: 1; }
.map-container { width: 100%; height: 100%; }

/* On mobile, prevent map controls from hiding behind the navbar */
@media (max-width: 768px) {
  .map-container { height: calc(100% - 60px - var(--safe-bottom)); }
}

/* Bottom controls — layer switcher */
.bottom-controls {
  position: absolute; bottom: calc(72px + var(--safe-bottom)); left: 14px;
  z-index: 1000; display: flex; align-items: center; gap: 10px;
}

/* Right-side controls — vertically centered column */
.right-controls {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rc-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--border-light);
  border-radius: 50%;
  color: var(--text-secondary);
  box-shadow: var(--shadow-lg);
  transition: all var(--transition);

  &:active { transform: scale(0.92); }
  &.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent-glow); box-shadow: var(--shadow-glow); }
}

.rc-zoom-pill {
  display: flex;
  flex-direction: column;
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.rc-zoom-btn {
  width: 40px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  transition: background 150ms;
}

.rc-zoom-btn:active { background: var(--bg-hover); }

.rc-zoom-divider {
  height: 1px;
  margin: 0 8px;
  background: var(--border-light);
}
.btn-spin {
  width: 18px; height: 18px; border: 2px solid var(--border-light);
  border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Toast */
.geo-toast {
  position: absolute; top: calc(80px + var(--safe-top)); left: 50%; transform: translateX(-50%);
  z-index: 1000; padding: 10px 18px; background: rgba(239,68,68,0.9);
  border-radius: 24px; font-size: 13px; font-weight: 500; color: white; white-space: nowrap;
}
.toast-enter-active { animation: toastIn 0.3s ease; }
.toast-leave-active { animation: toastIn 0.2s ease reverse; }
@keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

/* Nearby badge */
.nearby-pill {
  position: absolute; bottom: calc(130px + var(--safe-bottom)); left: 50%; transform: translateX(-50%);
  z-index: 1000; display: flex; align-items: center; gap: 8px;
  padding: 10px 20px; background: var(--bg-glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--border-light); border-radius: 24px;
  font-size: 13px; font-weight: 500; color: var(--text-secondary); box-shadow: var(--shadow-lg);
  white-space: nowrap; transition: all var(--transition);
}
.nearby-pill {
  &:active { transform: translateX(-50%) scale(0.95); }
  &.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent-glow); }
  &.loading { pointer-events: none; }
  &.error { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
  &.empty { color: var(--text-muted); }
}
.pill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 2s infinite; flex-shrink: 0; }
.pill-spinner {
  width: 14px; height: 14px; border: 2px solid var(--border-light);
  border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0;
}
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
.pill-close { display: flex; align-items: center; color: inherit; opacity: 0.7; margin-left: 2px; }

/* Layer switcher */
.layer-sw {
  display: flex; gap: 2px;
  background: var(--bg-glass); backdrop-filter: var(--blur);
  padding: 3px; border-radius: var(--radius);
  border: 1px solid var(--border-light); box-shadow: var(--shadow);
}
.layer-btn {
  padding: 7px 14px; font-size: 12px; border-radius: 9px;
  background: transparent; color: var(--text-secondary); font-weight: 500;
}
.layer-btn.active { background: var(--accent); color: white; box-shadow: 0 2px 8px rgba($accent, 0.3); }


/* Friend banner */
.friend-banner {
  position: fixed;
  top: calc(var(--safe-top) + 72px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1060;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  -webkit-backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--accent-glow);
  border-radius: 16px;
  box-shadow: var(--shadow-glow);
  white-space: nowrap;
  max-width: calc(100% - 32px);
}

.friend-banner-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.friend-banner-count {
  font-size: 11px;
  background: var(--accent-light);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 700;
}

.friend-banner-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 50%;
  flex-shrink: 0;

  &:active { transform: scale(0.95); }
}


/* Friend picker dropdown */
.friend-picker-overlay {
  position: absolute;
  inset: 0;
  z-index: 1002;
  background: rgba(0, 0, 0, 0.2);
}

.friend-picker {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: 62px;
  z-index: 1003;
  width: 220px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  -webkit-backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  animation: ctxIn 0.15s ease;
}

@keyframes ctxIn { from { transform: translateY(100%); } to { transform: translateY(0); } }

.friend-picker-title {
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
}

.friend-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  text-align: left;
  transition: background 150ms;

  &:active { background: var(--bg-hover); }
}

.friend-picker-avatar {
  @include avatar-gradient;
  width: 30px;
  height: 30px;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.friend-picker-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.friend-picker-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-picker-handle {
  font-size: 11px;
  color: var(--text-muted);
}

.friend-picker-count {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
}

/* User location marker (navigation arrow) */
:global(.user-loc-marker) {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.user-loc-ring) {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba($accent, 0.15);
  animation: userLocPulse 2s ease-in-out infinite;
}

@keyframes userLocPulse {
  0%, 100% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.4); opacity: 0; }
}

:global(.user-loc-arrow) {
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 2px 6px rgba($accent, 0.5));
}

/* Legend area container */
.legend-section {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: auto;
  z-index: 1100; /* Stays above overlay */
  pointer-events: none; /* Let clicks pass to dots/panel */
}

/* Unified Legend Container (Morphing) */
.legend-container {
  position: relative;
  left: 10px;
  top: 0;
  transform-origin: left center;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: var(--bg-glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  box-shadow: var(--shadow);
  cursor: pointer;
  padding: 8px 6px;
  width: 38px;
  min-width: 38px;
  gap: 6px; /* Collapsed gap */
  transition: 
    width 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    gap 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    padding 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    border-radius 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
  pointer-events: auto;

  /* Sequential closing: Wait for ALL text stagger to finish before resizing */
  &:not(.is-expanded) {
    transition-delay: calc(var(--total) * 0.05s + 0.25s);
    gap: 6px;
  }

  /* Robust hidden state during splash */
  :global(.pre-reveal) & {
    visibility: hidden !important;
    opacity: 0 !important;
  }

  &.is-expanded {
    width: 176px;
    min-width: 176px;
    gap: 6px;    /* Reduced from 10px */
    padding: 8px; /* Balanced padding */
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    cursor: default;
    transition-delay: 0s; /* Expand immediately */
  }
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 24px;
}

.legend-text-group {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 4px; /* Internal gap for name vs count */
}

/* Staggered sequential text transition */
.legend-text-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--index) * 0.05s);
}

.legend-text-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  /* Reverse stagger: bottom to top */
  transition-delay: calc((var(--total) - 1 - var(--index)) * 0.05s);
}

.legend-text-enter-from,
.legend-text-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

.legend-item-dot {
  width: 8px; /* Slightly smaller dot */
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-item-name {
  flex: 1;
  font-size: 12px; /* Slightly smaller text */
  font-weight: 500;
  color: #1a1a2e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-item-count {
  font-size: 10px; /* Slightly smaller count */
  font-weight: 600;
  color: #8b8ba7;
}

/* Transparent overlay catches clicks outside the legend */
.legend-panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050; /* Above map, below legend-section */
  background: transparent;
}


.legend-dot-item {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  border: 2px solid #2e2140;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 150ms ease;

  svg { display: block; }
}

.legend-container:not(.is-expanded):hover .legend-dot-item { transform: scale(1.15); }

/* Mobile — controls relative to shrunken map, no overlap with navbar */
@media (max-width: 768px) {
  .bottom-controls { bottom: calc(68px + var(--safe-bottom)); left: 10px; gap: 8px; }
  .layer-btn { padding: 6px 10px; font-size: 11px; }
  .nearby-pill { bottom: calc(120px + var(--safe-bottom)); font-size: 12px; padding: 8px 14px; }
  .right-controls { right: 10px; gap: 6px; }
  .rc-btn { width: 36px; height: 36px; }
  .rc-zoom-btn { width: 36px; height: 32px; }
  .friend-picker { right: 54px; }
  .legend-dots { left: 6px; gap: 4px; padding: 6px 4px; }
  .legend-panel { left: 6px; min-width: 140px; }
  .legend-item { padding: 6px 12px; }
  .legend-item-name { font-size: 12px; }
}

/* Friend profile card */
.friend-profile-overlay {
  position: absolute;
  inset: 0;
  z-index: 1002;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.friend-profile-card {
  position: relative;
  width: 100%;
  max-width: 300px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  -webkit-backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: ctxIn 0.2s ease;
}

.friend-profile-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 50%;
  color: var(--text-muted);
  border: none;

  &:active { transform: scale(0.9); }
}

.friend-profile-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 16px;
  gap: 8px;
}

.friend-profile-avatar {
  @include avatar-gradient;
  width: 72px;
  height: 72px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba($accent, 0.25);
}

.friend-profile-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.friend-profile-avatar-initial {
  color: white;
  font-size: 28px;
  font-weight: 700;
}

.friend-profile-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.friend-profile-handle {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.friend-profile-details {
  padding: 0 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.friend-profile-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  justify-content: center;
}

.friend-profile-bio {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}

.friend-profile-cuisines {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.friend-profile-cuisine-chip {
  padding: 4px 12px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.friend-profile-stat {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
}

.friend-profile-stat-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--accent);
}

.friend-profile-stat-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.friend-profile-view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 32px);
  margin: 8px 16px 20px;
  padding: 13px;
  background: var(--accent);
  color: white;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  transition: background 150ms;
}

.friend-profile-view-btn {
  &:hover { background: var(--accent-hover); }
  &:active { transform: scale(0.97); }
}
</style>
