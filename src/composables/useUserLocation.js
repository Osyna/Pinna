import { ref } from 'vue'

// Singleton state — shared across all components
const userLat = ref(null)
const userLng = ref(null)
const accuracy = ref(null)
const locating = ref(false)
const error = ref('')
let watchId = null

/* ── Last-known-position cache ──
   The last good fix is persisted so the locate button can jump to it
   INSTANTLY (and distances work right at boot), while a fresh fix is
   fetched in the background to update it when possible. */
const LS_KEY = 'pinna-last-pos'
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function readCachedPosition() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY))
    if (v && typeof v.lat === 'number' && typeof v.lng === 'number' &&
        Date.now() - (v.ts || 0) < CACHE_MAX_AGE) {
      return v
    }
  } catch { /* corrupt cache */ }
  return null
}

function writeCachedPosition() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      lat: userLat.value, lng: userLng.value, accuracy: accuracy.value, ts: Date.now(),
    }))
  } catch { /* storage full/blocked */ }
}

// Hydrate from cache at module load — approximate position immediately
const boot = readCachedPosition()
if (boot) {
  userLat.value = boot.lat
  userLng.value = boot.lng
  accuracy.value = boot.accuracy || null
}

/* Fresh fix with a HARD safety guard: browsers keep getCurrentPosition
   pending forever while a permission prompt is undecided — the guard
   guarantees the spinner always ends. */
function getFreshPosition() {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn, val) => {
      if (settled) return
      settled = true
      clearTimeout(guard)
      locating.value = false
      fn(val)
    }
    const guard = setTimeout(() => {
      error.value = 'Location timeout'
      setTimeout(() => { error.value = '' }, 4000)
      finish(reject, 'Location timeout')
    }, 20000)

    navigator.geolocation.getCurrentPosition(
      (pos) => { applyPosition(pos); finish(resolve, { lat: pos.coords.latitude, lng: pos.coords.longitude }) },
      () => {
        // Fallback: low accuracy, generous staleness
        navigator.geolocation.getCurrentPosition(
          (pos) => { applyPosition(pos); finish(resolve, { lat: pos.coords.latitude, lng: pos.coords.longitude }) },
          (err) => {
            if (err.code === 1) error.value = 'Location access denied'
            else if (err.code === 2) error.value = 'Location unavailable'
            else error.value = 'Location timeout'
            setTimeout(() => { error.value = '' }, 4000)
            finish(reject, error.value)
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

/**
 * Locate the user.
 * With a cached position: resolves IMMEDIATELY with it ({ cached: true,
 * fresh: Promise }) while the real fix updates refs in the background.
 * Without: resolves/rejects with the fresh fix (spinner bounded to 20 s).
 */
function locate() {
  if (!('geolocation' in navigator)) {
    error.value = 'Geolocation not supported'
    return Promise.reject(error.value)
  }
  error.value = ''

  const cached = readCachedPosition()
  if (cached) {
    userLat.value = cached.lat
    userLng.value = cached.lng
    accuracy.value = cached.accuracy || null
    locating.value = false
    const fresh = getFreshPosition()
    fresh.catch(() => {})
    return Promise.resolve({ lat: cached.lat, lng: cached.lng, cached: true, fresh })
  }

  locating.value = true
  return getFreshPosition()
}

function applyPosition(pos) {
  userLat.value = pos.coords.latitude
  userLng.value = pos.coords.longitude
  accuracy.value = pos.coords.accuracy
  locating.value = false
  writeCachedPosition()
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
