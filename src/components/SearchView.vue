<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePlacesStore } from '../stores/places'
import { useFriendsStore } from '../stores/friends'
import { useGeocoding } from '../composables/useGeocoding'
import { iconPathFor } from '../categoryIcons'
import { useFuseSearch } from '../composables/useFuseSearch'
import { useUserLocation } from '../composables/useUserLocation'
import { useRecentSearches } from '../composables/useRecentSearches'

const emit = defineEmits(['show-detail', 'select', 'add-place'])
const store = usePlacesStore()
const friendsStore = useFriendsStore()
const { results: osmResults, loading: osmLoading, search: osmSearch, clearResults } = useGeocoding()
const searchablePlaces = computed(() => friendsStore.viewingFriendId ? friendsStore.viewingFriendPlaces : store.places)
const { search: fuseSearch } = useFuseSearch(searchablePlaces)
const { userLat, userLng, locate, locating, distanceTo, formatDistance } = useUserLocation()

const recentSearches = useRecentSearches()

const query = ref('')
const nearMe = ref(false)
const scrolled = ref(false)
const listEl = ref(null)
const activeFilter = ref(null)
const selectedCountry = ref('be')
const cityFilter = ref('')
let debounceTimer = null
let cityDebounceTimer = null

/* Desktop: let the mouse wheel scroll horizontal chip rows */
function onChipRowWheel(e) {
  e.currentTarget.scrollLeft += (e.deltaY || 0) + (e.deltaX || 0)
}

const PLACE_FILTERS = [
  { key: 'restaurant', label: 'Restaurant', icon: 'utensils', color: '#FF3B30' },
  { key: 'cafe', label: 'Cafe', icon: 'coffee', color: '#FF9500' },
  { key: 'bar', label: 'Bar', icon: 'glass', color: '#AF52DE' },
  { key: 'hotel', label: 'Hotel', icon: 'bed', color: '#30B0C7' },
  { key: 'shop', label: 'Shop', icon: 'bag', color: '#FF66CC' },
  { key: 'museum', label: 'Museum', icon: 'museum', color: '#007AFF' },
  { key: 'park', label: 'Park', icon: 'tree', color: '#34C759' },
  { key: 'pharmacy', label: 'Pharmacy', icon: 'cross', color: '#38c172' },
]

const COUNTRIES = [
  { code: '', label: 'All countries' },
  { code: 'be', label: 'Belgium' },
  { code: 'fr', label: 'France' },
  { code: 'nl', label: 'Netherlands' },
  { code: 'de', label: 'Germany' },
  { code: 'lu', label: 'Luxembourg' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'es', label: 'Spain' },
  { code: 'it', label: 'Italy' },
  { code: 'pt', label: 'Portugal' },
  { code: 'ch', label: 'Switzerland' },
  { code: 'at', label: 'Austria' },
  { code: 'ie', label: 'Ireland' },
  { code: 'dk', label: 'Denmark' },
  { code: 'se', label: 'Sweden' },
  { code: 'no', label: 'Norway' },
  { code: 'fi', label: 'Finland' },
  { code: 'pl', label: 'Poland' },
  { code: 'cz', label: 'Czech Republic' },
  { code: 'gr', label: 'Greece' },
  { code: 'hr', label: 'Croatia' },
  { code: 'ro', label: 'Romania' },
  { code: 'hu', label: 'Hungary' },
  { code: 'bg', label: 'Bulgaria' },
  { code: 'sk', label: 'Slovakia' },
  { code: 'si', label: 'Slovenia' },
  { code: 'ee', label: 'Estonia' },
  { code: 'lv', label: 'Latvia' },
  { code: 'lt', label: 'Lithuania' },
  { code: 'cy', label: 'Cyprus' },
  { code: 'mt', label: 'Malta' },
  { code: 'us', label: 'United States' },
  { code: 'ca', label: 'Canada' },
  { code: 'mx', label: 'Mexico' },
  { code: 'br', label: 'Brazil' },
  { code: 'ar', label: 'Argentina' },
  { code: 'co', label: 'Colombia' },
  { code: 'cl', label: 'Chile' },
  { code: 'pe', label: 'Peru' },
  { code: 'jp', label: 'Japan' },
  { code: 'kr', label: 'South Korea' },
  { code: 'cn', label: 'China' },
  { code: 'tw', label: 'Taiwan' },
  { code: 'th', label: 'Thailand' },
  { code: 'vn', label: 'Vietnam' },
  { code: 'id', label: 'Indonesia' },
  { code: 'my', label: 'Malaysia' },
  { code: 'sg', label: 'Singapore' },
  { code: 'ph', label: 'Philippines' },
  { code: 'in', label: 'India' },
  { code: 'au', label: 'Australia' },
  { code: 'nz', label: 'New Zealand' },
  { code: 'za', label: 'South Africa' },
  { code: 'ma', label: 'Morocco' },
  { code: 'tn', label: 'Tunisia' },
  { code: 'eg', label: 'Egypt' },
  { code: 'tr', label: 'Turkey' },
  { code: 'ae', label: 'UAE' },
  { code: 'il', label: 'Israel' },
  { code: 'ru', label: 'Russia' },
  { code: 'ua', label: 'Ukraine' },
  { code: 'is', label: 'Iceland' },
]

onMounted(() => {
  if (userLat.value == null) locate().catch(() => {})
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  clearTimeout(cityDebounceTimer)
})

// Build a viewbox around the user for local-biased results
function getUserViewbox() {
  if (userLat.value == null) return null
  return {
    south: userLat.value - 0.15,
    west: userLng.value - 0.15,
    north: userLat.value + 0.15,
    east: userLng.value + 0.15,
  }
}

function runSearch() {
  const q = query.value.trim()
  if (!q || q.length < 2) {
    clearResults()
    return
  }
  recentSearches.add(query.value)
  const viewbox = nearMe.value ? getUserViewbox() : null
  const opts = {}
  if (activeFilter.value) opts.typeFilter = activeFilter.value
  if (selectedCountry.value) opts.countryCode = selectedCountry.value
  if (cityFilter.value.trim()) opts.city = cityFilter.value.trim()
  osmSearch(q, viewbox, opts)
}

function onListScroll() {
  if (listEl.value) scrolled.value = listEl.value.scrollTop > 20
}

function dismissKeyboard() {
  if (document.activeElement) document.activeElement.blur()
}

// Debounced Nominatim search on query/filter/country change
watch([query, activeFilter, selectedCountry], () => {
  clearTimeout(debounceTimer)
  if (!query.value.trim() || query.value.trim().length < 2) {
    clearResults()
    return
  }
  debounceTimer = setTimeout(runSearch, 400)
})

// City input has its own debounce (longer, since user is typing)
watch(cityFilter, () => {
  clearTimeout(cityDebounceTimer)
  if (!query.value.trim() || query.value.trim().length < 2) return
  cityDebounceTimer = setTimeout(runSearch, 600)
})

// Saved-places that match the query (fuzzy)
const savedMatches = computed(() => {
  if (!query.value.trim() || query.value.trim().length < 2) return []
  return fuseSearch(query.value, 5)
})

// Check if an OSM result is already saved
const savedCoordSet = computed(() =>
  new Set(searchablePlaces.value.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`))
)

function isSaved(r) {
  return savedCoordSet.value.has(`${r.lat.toFixed(4)},${r.lng.toFixed(4)}`)
}

// OSM results with distance + saved flag
const discoveryResults = computed(() =>
  osmResults.value.map(r => ({
    ...r,
    _dist: distanceTo(r.lat, r.lng),
    _saved: isSaved(r),
  }))
)

function toggleFilter(key) {
  activeFilter.value = activeFilter.value === key ? null : key
}

async function toggleNearMe() {
  nearMe.value = !nearMe.value
  if (nearMe.value && userLat.value == null) {
    await locate().catch(() => {})
  }
  if (query.value.trim().length >= 2) runSearch()
}

// Tap a saved match → open detail
function openSaved(place) {
  emit('show-detail', place)
}

// Tap an OSM result → show on map
function selectOsm(result) {
  emit('select', result)
}

// Quick-save an OSM result
function quickSave(result) {
  emit('add-place', {
    lat: result.lat,
    lng: result.lng,
    name: result.name,
    address: result.fullName || result.address || '',
    website: result.website || '',
    category: result.isFoodDrink ? 'restaurant' : '',
  })
}

function getCatStyle(catId) {
  const cat = friendsStore.viewingFriendId ? friendsStore.getCategoryById(catId) : store.getCategoryById(catId)
  return { background: cat.color + '20', color: cat.color }
}
</script>

<template>
  <div class="search-view">
    <!-- Friend banner -->
    <div v-if="friendsStore.viewingFriendId" class="sv-friend-banner">
      <div class="sv-friend-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        </svg>
        <span>Viewing {{ friendsStore.viewingFriendInfo?.name || 'Friend' }}'s map</span>
      </div>
      <button class="sv-friend-close" @click="friendsStore.clearFriendView()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Header -->
    <div :class="['sv-header', 'view-hero', 'hero--search', { collapsed: scrolled }]">
      <span class="view-hero-icon">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </span>
      <div class="view-hero-text">
        <h1 class="sv-title">Discover</h1>
        <span class="sv-subtitle">Find new places on OpenStreetMap</span>
      </div>
    </div>

    <!-- Search input -->
    <div class="sv-search-wrap">
      <svg class="sv-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        v-model="query"
        type="text"
        placeholder="Search restaurants, cafes, bars..."
        class="sv-search"
        autocomplete="off"
      />
      <button v-if="query" class="sv-search-clear" @click="query = ''">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Mode chips -->
    <div class="sv-mode-bar">
      <button :class="['sv-mode-chip', { active: nearMe }]" @click="toggleNearMe">
        <svg v-if="!locating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        <div v-else class="chip-spin"></div>
        Near Me
      </button>
      <div class="sv-mode-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>{{ nearMe ? 'Searching near your location' : 'Try "sushi tokyo" or "cafe paris"' }}</span>
      </div>
    </div>

    <!-- Country & City filters -->
    <div class="sv-loc-filters">
      <div class="sv-select-wrap">
        <svg class="sv-select-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
        </svg>
        <select v-model="selectedCountry" class="sv-select">
          <option v-for="c in COUNTRIES" :key="c.code" :value="c.code">{{ c.label }}</option>
        </select>
      </div>
      <div class="sv-city-wrap">
        <svg class="sv-city-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1"/>
          <path d="M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16"/>
        </svg>
        <input
          v-model="cityFilter"
          type="text"
          placeholder="City..."
          class="sv-city-input"
          autocomplete="off"
        />
        <button v-if="cityFilter" class="sv-city-clear" @click="cityFilter = ''">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Type filter chips -->
    <div class="sv-filters" @wheel.prevent="onChipRowWheel">
      <button
        v-for="f in PLACE_FILTERS" :key="f.key"
        :class="['sv-filter-chip', { active: activeFilter === f.key }]"
        @click="toggleFilter(f.key)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="f.color" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path :d="iconPathFor(f.icon)" />
        </svg>
        {{ f.label }}
      </button>
    </div>

    <!-- Results area -->
    <div class="sv-list" ref="listEl" @scroll="onListScroll" @touchstart="dismissKeyboard">
      <!-- Skeleton loading cards -->
      <div v-if="osmLoading" class="sv-skeletons">
        <div v-for="i in 3" :key="i" class="sv-skeleton-card">
          <div class="sk-dot"></div>
          <div class="sk-body">
            <div class="sk-line w70"></div>
            <div class="sk-line w40"></div>
            <div class="sk-line w90"></div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!query.trim()" class="sv-empty-state">
        <div v-if="recentSearches.recents.value.length" class="sv-section">
          <div class="sv-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Recent
            <button class="sv-clear-recents" @click="recentSearches.clear()">Clear</button>
          </div>
          <div class="sv-recent-chips">
            <button v-for="r in recentSearches.recents.value" :key="r" class="sv-recent-chip" @click="query = r">
              {{ r }}
            </button>
          </div>
        </div>
        <div class="sv-empty">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.15">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
          </svg>
          <p class="sv-empty-title">Search the world</p>
          <p class="sv-empty-sub">Find restaurants, cafes, bars, and more from OpenStreetMap</p>
        </div>
      </div>

      <div v-else-if="!osmLoading && discoveryResults.length === 0 && savedMatches.length === 0" class="sv-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>No results for "{{ query }}"</p>
        <p class="sv-empty-sub">Try a different name or add a city (e.g. "pizza rome")</p>
      </div>

      <template v-else>
        <!-- Saved matches -->
        <div v-if="savedMatches.length" class="sv-section">
          <div class="sv-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            Your Places
          </div>
          <button
            v-for="place in savedMatches" :key="'s-' + place.id"
            class="sv-card saved"
            @click="openSaved(place)"
          >
            <div class="sv-card-left">
              <span class="sv-cat-dot" :style="{ background: store.getCategoryById(place.category).color }"></span>
            </div>
            <div class="sv-card-body">
              <div class="sv-card-top">
                <span class="sv-card-name">{{ place.name }}</span>
                <span class="sv-saved-badge">Saved</span>
              </div>
              <div class="sv-card-meta">
                <span v-if="place.cuisine && place.cuisine !== 'None'" class="sv-card-cuisine">{{ place.cuisine }}</span>
                <span class="sv-cat-label" :style="getCatStyle(place.category)">{{ store.getCategoryById(place.category).name }}</span>
              </div>
              <p v-if="place.address" class="sv-card-addr">{{ place.address }}</p>
            </div>
          </button>
        </div>

        <!-- Discovery results -->
        <div v-if="discoveryResults.length" class="sv-section">
          <div class="sv-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            OpenStreetMap
            <span class="sv-section-count">{{ discoveryResults.length }}</span>
          </div>
          <div
            v-for="result in discoveryResults" :key="'d-' + result.id"
            class="sv-card discovery"
          >
            <button class="sv-card-main" @click="selectOsm(result)">
              <div class="sv-card-left">
                <div :class="['sv-type-dot', { food: result.isFoodDrink }]"></div>
              </div>
              <div class="sv-card-body">
                <div class="sv-card-top">
                  <span class="sv-card-name">{{ result.name }}</span>
                  <span v-if="result._dist != null" class="sv-card-dist">{{ formatDistance(result._dist) }}</span>
                </div>
                <div class="sv-card-meta">
                  <span v-if="result.isFoodDrink" class="sv-type-label food">
                    {{ result.type.replace(/_/g, ' ') }}
                  </span>
                  <span v-else class="sv-type-label">{{ result.type.replace(/_/g, ' ') }}</span>
                  <span v-if="result.city" class="sv-card-city">{{ result.city }}{{ result.country ? ', ' + result.country : '' }}</span>
                </div>
                <p v-if="result.address" class="sv-card-addr">{{ result.address }}</p>
              </div>
            </button>
            <button
              v-if="!result._saved"
              class="sv-save-btn"
              @click.stop="quickSave(result)"
              title="Save place"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <span v-else class="sv-saved-badge sm">Saved</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-view {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top);
  padding-bottom: calc(60px + var(--safe-bottom));
}

/* ─── Header ─── */
.sv-friend-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin: 8px 14px 0;
  background: var(--accent-light);
  border: 1px solid var(--accent-glow);
  border-radius: var(--radius);
  flex-shrink: 0;
}

.sv-friend-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.sv-friend-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 50%;
  flex-shrink: 0;

  &:active { transform: scale(0.9); }
}

.sv-header {
  padding: 16px 20px 4px;
  flex-shrink: 0;
  transition: all 0.25s ease;

  &.collapsed {
    padding: 10px 20px 2px;

    .sv-title { font-size: 20px; }
    .sv-subtitle { display: none; }
  }
}

.sv-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, $accent, $accent-hover);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
}

.sv-subtitle {
  display: block;
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
  margin-top: 2px;
}

/* ─── Search ─── */
.sv-search-wrap {
  margin: 10px 16px 0;
  position: relative;
  flex-shrink: 0;
}

.sv-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.sv-search {
  width: 100%;
  height: 48px;
  padding: 0 40px 0 44px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  font-size: 15px;

  &:focus {
    @include input-focus;
  }

  &::placeholder { color: var(--text-muted); }
}

.sv-search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-radius: 50%;
}

/* ─── Mode bar ─── */
.sv-mode-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  flex-shrink: 0;
}

.sv-mode-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  font-size: 13px;
  border-radius: 20px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  font-weight: 600;
  white-space: nowrap;

  &.active {
    @include chip-active;
  }
}

.chip-spin {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-light);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.sv-mode-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  min-width: 0;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ─── Location filters ─── */
.sv-loc-filters {
  display: flex;
  gap: 8px;
  padding: 0 16px 8px;
  flex-shrink: 0;
}

.sv-select-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.sv-select-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.sv-select {
  width: 100%;
  height: 36px;
  padding: 0 8px 0 30px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 10px;
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;

  &:focus {
    border-color: var(--accent);
    outline: none;
  }
}

.sv-city-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.sv-city-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.sv-city-input {
  width: 100%;
  height: 36px;
  padding: 0 28px 0 30px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 10px;
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;

  &:focus {
    border-color: var(--accent);
    outline: none;
  }

  &::placeholder { color: var(--text-muted); }
}

.sv-city-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-radius: 50%;
}

/* ─── Filters ─── */
.sv-filters {
  display: flex;
  gap: 6px;
  padding: 0 16px 10px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;

  &::-webkit-scrollbar { display: none; }
}

.sv-filter-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;

  svg { flex-shrink: 0; }
  font-size: 12px;
  border-radius: 20px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  font-weight: 500;
  white-space: nowrap;
  transition: all 150ms ease;

  &.active {
    @include chip-active;
    font-weight: 600;
  }
}

/* ─── List ─── */
.sv-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 0 12px 12px;
}

/* Loading */
.sv-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
}

.sv-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Empty */
.sv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  text-align: center;
  color: var(--text-muted);
  gap: 8px;
}

.sv-empty-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-secondary);
}

.sv-empty-sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 260px;
  line-height: 1.5;
}

/* ─── Sections ─── */
.sv-section {
  margin-bottom: 16px;
}

.sv-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sv-section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  background: var(--bg-tertiary);
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
}

/* ─── Cards ─── */
.sv-card {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  margin-bottom: 6px;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-align: left;
  transition: all 150ms ease;
  box-shadow: var(--shadow), inset 0 1px 0 var(--glass-highlight);

  &:active { background: var(--bg-hover); }

  &.saved {
    padding: 14px;
    gap: 12px;
    cursor: pointer;
  }

  &.discovery {
    overflow: hidden;
  }
}

.sv-card-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  min-width: 0;
  text-align: left;
  background: none;
  cursor: pointer;

  &:active {
    background: var(--bg-hover);
    transform: scale(0.98);
  }
}

.sv-card-left { flex-shrink: 0; }

.sv-cat-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.sv-type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
  opacity: 0.5;

  &.food {
    background: var(--accent);
    opacity: 1;
  }
}

.sv-card-body {
  flex: 1;
  min-width: 0;
}

.sv-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sv-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sv-card-dist {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: 8px;
}

.sv-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 0;
}

.sv-card-cuisine {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.sv-cat-label {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.sv-type-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  text-transform: capitalize;

  &.food {
    color: var(--accent);
  }
}

.sv-card-city {
  font-size: 11px;
  color: var(--text-muted);
}

.sv-card-addr {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Saved badge */
.sv-saved-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
  padding: 3px 10px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  &.sm {
    margin-right: 12px;
    font-size: 9px;
    padding: 2px 8px;
  }
}

/* Save button */
.sv-save-btn {
  flex-shrink: 0;
  width: 44px;
  height: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  color: var(--accent);
  border-left: 1px solid var(--border);
  transition: all 150ms ease;

  &:hover { background: var(--accent-light); }
  &:active { background: var(--accent); color: white; }
}

/* ─── Skeleton loading ─── */
.sv-skeletons { padding: 8px; }

.sv-skeleton-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px; margin-bottom: 6px;
  background: var(--bg-glass-light); border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.sk-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--bg-tertiary); flex-shrink: 0; }
.sk-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }

.sk-line {
  height: 12px; border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-glass-light) 25%, var(--bg-hover) 50%, var(--bg-glass-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  &.w70 { width: 70%; }
  &.w40 { width: 40%; }
  &.w90 { width: 90%; }
}

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ─── Recent searches ─── */
.sv-recent-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 8px; }

.sv-recent-chip {
  padding: 6px 14px; font-size: 13px; border-radius: var(--radius-full);
  background: var(--bg-glass-light); color: var(--text-secondary);
  border: 1px solid var(--border); font-weight: 500;
}

.sv-clear-recents {
  margin-left: auto; font-size: 11px; color: var(--text-muted);
  background: none; padding: 0;
}
</style>
