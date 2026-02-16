<script setup>
import { ref, watch, computed } from 'vue'
import { useGeocoding } from '../composables/useGeocoding'
import { usePlacesStore } from '../stores/places'
import { useFriendsStore } from '../stores/friends'
import { useFuseSearch } from '../composables/useFuseSearch'
import { useUserLocation } from '../composables/useUserLocation'

const props = defineProps({
  mapRef: { type: Object, default: null },

})

const emit = defineEmits(['select'])

const store = usePlacesStore()
const friendsStore = useFriendsStore()
const { results: apiResults, loading, search: apiSearch, clearResults } = useGeocoding()
const searchablePlaces = computed(() => friendsStore.viewingFriendId ? friendsStore.viewingFriendPlaces : store.places)
const { search: fuseSearch } = useFuseSearch(searchablePlaces)
const { userLat, userLng } = useUserLocation()

const query = ref('')
const showResults = ref(false)
const inputFocused = ref(false)
let debounceTimer = null

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

function getDistanceTier(km) {
  if (km < 2) return 'Nearby'
  if (km < 15) return 'Same city'
  if (km < 80) return 'Same area'
  return 'Further away'
}

function getMapCenter() {
  if (props.mapRef && props.mapRef.getCenter) return props.mapRef.getCenter()
  return null
}

const savedResults = computed(() => {
  const q = query.value.trim()
  if (q.length < 2) return []
  // Prefer user GPS location for stable distance ranking, fallback to map center
  const anchor = (userLat.value != null)
    ? { lat: userLat.value, lng: userLng.value }
    : getMapCenter()
  // For multi-word queries, limit saved results to leave room for API results
  const tokens = q.split(/\s+/).filter(t => t.length >= 2)
  const maxSaved = tokens.length > 1 ? 4 : 8
  const matched = fuseSearch(q, maxSaved + 4)
  const withScore = matched.map((p, rank) => {
    const dist = anchor ? haversine(anchor.lat, anchor.lng, p.lat, p.lng) : 0
    // Blend text relevance with distance so nearby matches win when text quality is similar
    const textRank = matched.length > 1 ? rank / (matched.length - 1) : 0
    const distNorm = anchor ? Math.min(Math.log10(dist + 1) / 3, 1) : 0
    const score = textRank * 0.3 + distNorm * 0.7
    return { ...p, _distance: dist, _tier: getDistanceTier(dist), _score: score }
  })
  withScore.sort((a, b) => a._score - b._score)
  return withScore.slice(0, maxSaved)
})

const combinedResults = computed(() => {
  const anchor = (userLat.value != null)
    ? { lat: userLat.value, lng: userLng.value }
    : getMapCenter()
  const saved = savedResults.value.map(p => ({
    id: p.id, name: p.name,
    fullName: p.address || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`,
    lat: p.lat, lng: p.lng, isSaved: true,
    category: p.category, rating: p.rating, cuisine: p.cuisine,
    distance: p._distance,
    distanceLabel: anchor ? formatDistance(p._distance) : '',
    tier: p._tier,
  }))
  const savedCoords = new Set(saved.map(s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`))
  const api = apiResults.value
    .filter(r => !savedCoords.has(`${r.lat.toFixed(4)},${r.lng.toFixed(4)}`))
    .map(r => {
      const dist = anchor ? haversine(anchor.lat, anchor.lng, r.lat, r.lng) : 0
      return { ...r, isSaved: false, distance: dist, distanceLabel: anchor ? formatDistance(dist) : '', tier: getDistanceTier(dist) }
    })
  api.sort((a, b) => a.distance - b.distance)
  return [...saved, ...api].slice(0, 12)
})

const savedTiers = computed(() => {
  const tiers = []
  let cur = null
  for (const r of combinedResults.value) {
    if (!r.isSaved) break
    if (r.tier !== cur) { tiers.push({ label: r.tier, startIndex: combinedResults.value.indexOf(r) }); cur = r.tier }
  }
  return tiers
})

const firstApiIndex = computed(() => combinedResults.value.findIndex(r => !r.isSaved))



watch(query, (val) => {
  clearTimeout(debounceTimer)
  if (val.trim().length < 2) { clearResults(); showResults.value = false; return }
  showResults.value = true
  debounceTimer = setTimeout(() => {
    let viewbox = null
    if (props.mapRef && props.mapRef.getBounds) viewbox = props.mapRef.getBounds()
    apiSearch(val, viewbox)
  }, 400)
})

function selectResult(result) {
  query.value = result.name
  showResults.value = false
  inputFocused.value = false
  clearResults()
  emit('select', result)
}

function saveAndSelect(result) {
  store.addPlace({ name: result.name, lat: result.lat, lng: result.lng, address: result.fullName, category: 'other' })
  selectResult(result)
}

function clearSearch() { query.value = ''; clearResults(); showResults.value = false }
function onFocus() { inputFocused.value = true; if (query.value.trim().length >= 2) showResults.value = true }
function onBlur() { setTimeout(() => { showResults.value = false; inputFocused.value = false }, 200) }
function getCatColor(catId) { const c = store.getCategoryById(catId); return c ? c.color : '#64748b' }
</script>

<template>
  <div :class="['search-overlay', { focused: inputFocused && showResults }]">
    <div class="search-bar">
      <div class="search-input-wrapper">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="query" type="text" placeholder="Search places..." class="search-input"
          @focus="onFocus" @blur="onBlur" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" />
        <div v-if="loading" class="search-spinner"></div>
        <button v-if="query" class="clear-btn" @click="clearSearch">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>


    <!-- Results -->
    <div v-if="showResults && combinedResults.length > 0" class="search-results">
      <template v-for="(result, idx) in combinedResults" :key="result.id || idx">
        <div v-if="result.isSaved && savedTiers.some(t => t.startIndex === idx)" class="section-label">
          {{ result.tier }}
        </div>
        <div v-if="!result.isSaved && idx === firstApiIndex && savedResults.length > 0" class="section-label api-label">
          Search Results
        </div>
        <div class="result-row" @click="selectResult(result)">
          <div :class="['result-icon', { saved: result.isSaved }]"
            :style="result.isSaved ? { background: getCatColor(result.category) + '25', color: getCatColor(result.category) } : {}">
            <svg v-if="result.isSaved" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </div>
          <div class="result-text">
            <div class="result-name">
              {{ result.name }}
              <span v-if="result.isSaved && result.rating" class="result-stars">{{ '\u2605'.repeat(result.rating) }}</span>
            </div>
            <div class="result-addr">
              <span v-if="result.isSaved && result.cuisine && result.cuisine !== 'None'" class="result-cuisine">{{ result.cuisine }}</span>
              {{ result.fullName }}
            </div>
          </div>
          <span v-if="result.distanceLabel" class="dist-badge">{{ result.distanceLabel }}</span>
          <button v-if="!result.isSaved" class="save-btn" @click.stop="saveAndSelect(result)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <div v-else class="saved-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>
      </template>
    </div>

    <div v-if="showResults && !loading && query.trim().length >= 2 && combinedResults.length === 0" class="search-results">
      <div class="no-results">No places found</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-overlay {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1050;
  padding: calc(12px + var(--safe-top)) 14px 0; pointer-events: none;

  > * { pointer-events: auto; }

  &.focused {
    bottom: 0; background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); pointer-events: auto;
  }
}

.search-bar { display: flex; align-items: center; max-width: 600px; }

.search-input-wrapper { flex: 1; position: relative; display: flex; align-items: center; }

.search-icon { position: absolute; left: 16px; color: var(--text-muted); pointer-events: none; }

.search-input {
  width: 100%; height: 48px; padding: 0 44px 0 48px;
  background: var(--bg-glass); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);
  color: var(--text-primary); border-radius: 24px; border: 1px solid var(--border-light);
  font-size: 15px; box-shadow: var(--shadow-lg);

  &::placeholder { color: var(--text-muted); }
  &:focus { border-color: var(--accent); box-shadow: var(--shadow-lg), 0 0 0 3px var(--accent-light); }
}

.search-spinner {
  position: absolute; right: 44px; width: 18px; height: 18px;
  border: 2px solid var(--bg-tertiary); border-top-color: var(--accent);
  border-radius: 50%; animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.clear-btn {
  position: absolute; right: 12px; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-tertiary); color: var(--text-secondary); border-radius: 50%;
}

// Results
.search-results {
  margin-top: 8px; max-width: 600px;
  background: var(--bg-surface); backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-light); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg); max-height: 60vh;
  overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 6px;
}

.section-label {
  padding: 10px 14px 6px; font-size: 11px; font-weight: 700;
  color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;

  &.api-label {
    color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 4px; padding-top: 12px;
  }
}

.result-row {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-radius: var(--radius); cursor: pointer; transition: background 150ms; min-height: 52px;

  &:active { background: var(--accent-light); }
}

.result-icon {
  flex-shrink: 0; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; background: var(--accent-light); color: var(--accent);
}

.result-text { flex: 1; min-width: 0; }

.result-name { font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }

.result-stars { font-size: 11px; color: #f59e0b; letter-spacing: 1px; }

.result-addr {
  font-size: 12px; color: var(--text-muted); margin-top: 2px;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
}

.result-cuisine { color: var(--accent); font-weight: 500; margin-right: 4px; }

.dist-badge {
  flex-shrink: 0; font-size: 10px; font-weight: 600; color: var(--accent);
  background: var(--accent-light); padding: 3px 8px; border-radius: 10px;
}

.save-btn {
  flex-shrink: 0; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
  background: var(--accent-light); color: var(--accent); border-radius: 50%;
}

.saved-check { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: var(--success); opacity: 0.7; }

.no-results { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }
</style>
