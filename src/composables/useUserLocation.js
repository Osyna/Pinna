import { ref } from 'vue'

// Singleton state — shared across all components
const userLat = ref(null)
const userLng = ref(null)
const accuracy = ref(null)
const locating = ref(false)
const error = ref('')
let watchId = null

function locate() {
  if (!('geolocation' in navigator)) {
    error.value = 'Geolocation not supported'
    return Promise.reject(error.value)
  }
  locating.value = true
  error.value = ''

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyPosition(pos)
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        // Fallback: low accuracy with very long timeout and stale cache
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            applyPosition(pos)
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          },
          (err) => {
            locating.value = false
            if (err.code === 1) error.value = 'Location access denied'
            else if (err.code === 2) error.value = 'Location unavailable'
            else error.value = 'Location timeout'
            setTimeout(() => { error.value = '' }, 4000)
            reject(error.value)
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

function applyPosition(pos) {
  userLat.value = pos.coords.latitude
  userLng.value = pos.coords.longitude
  accuracy.value = pos.coords.accuracy
  locating.value = false
}

/** Start passive background watching — call only from a user gesture handler */
function startWatching() {
  if (watchId != null || !('geolocation' in navigator)) return
  watchId = navigator.geolocation.watchPosition(
    (pos) => applyPosition(pos),
    () => {},
    { enableHighAccuracy: true, maximumAge: 60000 },
  )
}

function stopWatching() {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

// Haversine distance in km
function distanceTo(lat, lng) {
  if (userLat.value == null) return null
  const R = 6371
  const dLat = (lat - userLat.value) * Math.PI / 180
  const dLng = (lng - userLng.value) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(userLat.value * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km) {
  if (km == null) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

export function useUserLocation() {
  return { userLat, userLng, accuracy, locating, error, locate, startWatching, stopWatching, distanceTo, formatDistance }
}
