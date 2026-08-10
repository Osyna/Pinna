<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { usePlacesStore } from '../stores/places'
import { iconPathFor } from '../categoryIcons'
import { useFriendsStore } from '../stores/friends'
import { useFuseSearch } from '../composables/useFuseSearch'
import { useUserLocation } from '../composables/useUserLocation'
import { hapticTap, hapticSuccess } from '../composables/useHaptics'
import { showToast } from '../composables/useToast'
import PlaceCardThumbnail from './PlaceCardThumbnail.vue'

const emit = defineEmits(['show-detail', 'add-place', 'import'])
const store = usePlacesStore()
const friendsStore = useFriendsStore()
const { userLat, userLng, locate, locating, distanceTo, formatDistance } = useUserLocation()

const activePlaces = computed(() => friendsStore.viewingFriendId ? friendsStore.viewingFriendPlaces : store.places)
const { search: fuseSearch } = useFuseSearch(activePlaces)

const search = ref('')

/* Desktop: let the mouse wheel scroll horizontal chip rows */
function onChipRowWheel(e) {
  e.currentTarget.scrollLeft += (e.deltaY || 0) + (e.deltaX || 0)
}

/* ── Recently Deleted ── */
const showTrash = ref(false)
const purgeConfirmId = ref(null)

function toggleTrash() {
  showTrash.value = !showTrash.value
  if (showTrash.value) store.fetchTrash()
}

async function doPurge(id) {
  await store.purgePlace(id)
  purgeConfirmId.value = null
}

function trashDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const activeCategory = ref(null)
onMounted(() => {
  if (userLat.value == null) locate().catch(() => {})
  if (!friendsStore.viewingFriendId) store.fetchTrash()
})

/* ── Lists (collections) ── */
const activeList = ref(null)
const newListMode = ref(false)
const newListName = ref('')

async function submitNewList() {
  const name = newListName.value.trim()
  newListMode.value = false
  newListName.value = ''
  if (!name) return
  const list = await store.createList(name).catch(() => null)
  if (list) activeList.value = list.id
}

async function removeList(id) {
  await store.deleteList(id).catch(() => {})
  if (activeList.value === id) activeList.value = null
}

/* ── Bulk selection ── */
const selectMode = ref(false)
const selectedIds = ref(new Set())
const showBulkCats = ref(false)

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedIds.value = new Set()
  showBulkCats.value = false
}

function toggleSelected(id) {
  const s = new Set(selectedIds.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selectedIds.value = s
}

async function bulkDeleteSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  await store.bulkDelete(ids)
  toggleSelectMode()
}

async function bulkMoveSelected(catId) {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  await store.bulkSetCategory(ids, catId)
  toggleSelectMode()
}

function onCardClick(place) {
  if (selectMode.value) toggleSelected(place.id)
  else emit('show-detail', place)
}

const sortedPlaces = computed(() => {
  let result = activePlaces.value

  if (activeCategory.value) {
    result = result.filter(p => p.category === activeCategory.value)
  }

  if (activeList.value) {
    const list = store.lists.find(l => l.id === activeList.value)
    if (list) {
      const inList = new Set(list.placeIds)
      result = result.filter(p => inList.has(p.id))
    }
  }

  if (search.value.trim()) {
    const matched = fuseSearch(search.value, 50)
    const matchedIds = new Set(matched.map(p => p.id))
    result = result.filter(p => matchedIds.has(p.id))
  }

  return result
    .map(p => ({ ...p, _dist: distanceTo(p.lat, p.lng) }))
    .sort((a, b) => {
      if (a._dist != null && b._dist != null) return a._dist - b._dist
      if (a._dist != null) return -1
      if (b._dist != null) return 1
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
})

/* ── Dynamic (chunked) rendering ──
   Search, counts and chips always run over the FULL sortedPlaces array
   (in-memory, instant — no lag, no accuracy loss). Only the DOM gets a
   bounded window: with 500+ saved places, mounting every card at once
   (icons, stars, tag lists, thumbnails) is what actually causes jank —
   not the data itself. The window grows as the user scrolls. */
const RENDER_BATCH = 60
const visibleCount = ref(RENDER_BATCH)
const displayedPlaces = computed(() => sortedPlaces.value.slice(0, visibleCount.value))
const loadSentinel = ref(null)
let sentinelObserver = null

// Reset the render window on actual filter changes only — NOT on the
// distance-driven re-sorts that happen every GPS update (those keep
// the same result set, just reordered, and shouldn't snap the list
// back to the top).
watch([activeCategory, activeList, search, () => friendsStore.viewingFriendId], () => {
  visibleCount.value = RENDER_BATCH
  listEl.value?.scrollTo?.({ top: 0 })
})

function growVisible() {
  if (visibleCount.value < sortedPlaces.value.length) {
    visibleCount.value = Math.min(visibleCount.value + RENDER_BATCH, sortedPlaces.value.length)
  }
}

watch(loadSentinel, (el) => {
  sentinelObserver?.disconnect()
  if (!el) return
  sentinelObserver = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) growVisible()
  }, { root: listEl.value, rootMargin: '600px 0px' })
  sentinelObserver.observe(el)
})

onBeforeUnmount(() => sentinelObserver?.disconnect())

function getCatStyle(catId) {
  const cat = friendsStore.viewingFriendId ? friendsStore.getCategoryById(catId) : store.getCategoryById(catId)
  return { background: cat.color + '20', color: cat.color }
}

function getCat(catId) {
  return friendsStore.viewingFriendId ? friendsStore.getCategoryById(catId) : store.getCategoryById(catId)
}

const activeCategories = computed(() => friendsStore.viewingFriendId ? friendsStore.viewingFriendCategories : store.categories)
const activePlaceCount = computed(() => activePlaces.value.length)
const activeCategoryCounts = computed(() => {
  const counts = {}
  for (const p of activePlaces.value) {
    counts[p.category] = (counts[p.category] || 0) + 1
  }
  return counts
})

function renderStars(r) {
  return r > 0 ? '\u2605'.repeat(r) + '\u2606'.repeat(5 - r) : ''
}

// Pull-to-refresh
const listEl = ref(null)
const pullDistance = ref(0)
const refreshing = ref(false)
let pullStartY = 0
let pulling = false

function onPullStart(e) {
  if (listEl.value && listEl.value.scrollTop <= 0) {
    pullStartY = e.touches[0].clientY
    pulling = true
  }
}

function onPullMove(e) {
  if (!pulling) return
  const dy = e.touches[0].clientY - pullStartY
  if (dy > 0) {
    pullDistance.value = Math.min(dy * 0.5, 80)
  }
}

async function onPullEnd() {
  if (!pulling) return
  pulling = false
  if (pullDistance.value > 50) {
    refreshing.value = true
    hapticTap()
    if (friendsStore.viewingFriendId) {
      await friendsStore.viewFriendPlaces(friendsStore.viewingFriendId)
    } else {
      await store.fetchPlaces()
    }
    refreshing.value = false
    hapticSuccess()
    showToast('Places refreshed')
  }
  pullDistance.value = 0
}

// Long-press context menu
const contextMenu = ref({ show: false, x: 0, y: 0, place: null })
let longPressTimer = null

function onCardPressStart(e, place) {
  longPressTimer = setTimeout(() => {
    hapticTap()
    const touch = e.touches ? e.touches[0] : e
    contextMenu.value = {
      show: true,
      x: Math.min(touch.clientX, window.innerWidth - 160),
      y: touch.clientY - 10,
      place,
    }
  }, 500)
}

function onCardPressEnd() {
  clearTimeout(longPressTimer)
}

function closeContextMenu() {
  contextMenu.value.show = false
}

function contextAction(action) {
  const place = contextMenu.value.place
  closeContextMenu()
  if (action === 'map') emit('show-detail', place)
  if (action === 'share' && navigator.share) {
    navigator.share({ title: place.name, text: place.address || place.name, url: `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}` }).catch(() => {})
  }
  if (action === 'delete') {
    store.removePlace(place.id)
    showToast('Place deleted')
  }
}
</script>

<template>
  <div class="places-view">
    <!-- Friend places banner -->
    <div v-if="friendsStore.viewingFriendId" class="pv-friend-banner">
      <div class="pv-friend-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        </svg>
        <span>{{ friendsStore.viewingFriendInfo?.name || 'Friend' }}'s Places</span>
      </div>
      <button class="pv-friend-close" @click="friendsStore.clearFriendView()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Header -->
    <div class="pv-header view-hero hero--places">
      <span class="view-hero-icon">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
        </svg>
      </span>
      <div class="view-hero-text">
        <h1 class="pv-title">{{ friendsStore.viewingFriendId ? (friendsStore.viewingFriendInfo?.name?.split(' ')[0] || 'Friend') + "'s Places" : 'My Places' }}</h1>
        <span class="pv-count">{{ activePlaceCount }} saved</span>
      </div>
      <div v-if="!friendsStore.viewingFriendId" class="pv-header-actions">
        <button class="pv-icon-btn" :class="{ on: showTrash }" title="Recently Deleted" aria-label="Recently Deleted" @click="toggleTrash">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          <span v-if="store.trashedPlaces.length" class="pv-icon-badge">{{ store.trashedPlaces.length }}</span>
        </button>
        <button class="pv-select-btn" :class="{ on: selectMode }" @click="toggleSelectMode">
          {{ selectMode ? 'Cancel' : 'Select' }}
        </button>
      </div>
    </div>

    <!-- Recently Deleted panel (floating, opened from the header icon) -->
    <div v-if="showTrash" class="pv-trash-overlay" @click="showTrash = false"></div>
    <div v-if="showTrash" class="pv-trash-card">
      <div class="pv-trash-card-head">
        <span>Recently Deleted</span>
        <button @click="showTrash = false">Done</button>
      </div>
      <p v-if="!store.trashedPlaces.length" class="pv-trash-empty">
        Nothing here — deleted places stay recoverable for 30 days.
      </p>
      <div v-else class="pv-trash-list">
        <div v-for="p in store.trashedPlaces" :key="p.id" class="pv-trash-row">
          <span class="pv-cat-icon small" :style="{ background: getCat(p.category).color + '22', color: getCat(p.category).color }">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path :d="iconPathFor(getCat(p.category).icon)" />
            </svg>
          </span>
          <div class="pv-trash-info">
            <span class="pv-trash-name">{{ p.name }}</span>
            <span class="pv-trash-date">deleted {{ trashDate(p.deletedAt) }}</span>
          </div>
          <template v-if="purgeConfirmId === p.id">
            <span class="pv-trash-ask">Forever?</span>
            <button class="pv-trash-btn danger" @click="doPurge(p.id)">Yes</button>
            <button class="pv-trash-btn" @click="purgeConfirmId = null">No</button>
          </template>
          <template v-else>
            <button class="pv-trash-btn restore" @click="store.restorePlace(p.id)">Restore</button>
            <button class="pv-trash-btn danger icon" title="Delete forever" @click="purgeConfirmId = p.id">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="pv-search-wrap">
      <svg class="pv-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input v-model="search" type="text" :placeholder="friendsStore.viewingFriendId ? 'Search their places...' : 'Search your places...'" class="pv-search" autocomplete="off" />
      <button v-if="search" class="pv-search-clear" aria-label="Clear search" @click="search = ''">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <!-- Category chips -->
    <div class="pv-cats" @wheel.prevent="onChipRowWheel">
      <button :class="['pv-chip', { active: !activeCategory }]" @click="activeCategory = null">
        All ({{ activePlaceCount }})
      </button>
      <button
        v-for="cat in activeCategories" :key="cat.id"
        :class="['pv-chip', { active: activeCategory === cat.id }]"
        :style="activeCategory === cat.id ? { background: cat.color + '22' } : {}"
        @click="activeCategory = activeCategory === cat.id ? null : cat.id"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" :stroke="cat.color" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path :d="iconPathFor(cat.icon)" />
        </svg>
        {{ cat.name }} ({{ activeCategoryCounts[cat.id] || 0 }})
      </button>
    </div>

    <!-- Lists row -->
    <div v-if="!friendsStore.viewingFriendId" class="pv-lists" @wheel.prevent="onChipRowWheel">
      <button
        v-for="l in store.lists" :key="l.id"
        :class="['pv-list-chip', { active: activeList === l.id }]"
        @click="activeList = activeList === l.id ? null : l.id"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
        {{ l.name }} ({{ l.placeIds.length }})
        <span v-if="activeList === l.id" class="pv-list-x" title="Delete list" @click.stop="removeList(l.id)">×</span>
      </button>
      <button v-if="!newListMode" class="pv-list-chip new" @click="newListMode = true">+ List</button>
      <input
        v-else
        v-model="newListName"
        class="pv-list-input"
        placeholder="List name…"
        autofocus
        @keyup.enter="submitNewList"
        @blur="submitNewList"
      />
    </div>

    <!-- Bulk action bar -->
    <div v-if="selectMode" class="pv-bulk-bar">
      <span class="pv-bulk-count">{{ selectedIds.size }} selected</span>
      <button class="pv-bulk-btn" :disabled="!selectedIds.size" @click="showBulkCats = !showBulkCats">Move to…</button>
      <button class="pv-bulk-btn danger" :disabled="!selectedIds.size" @click="bulkDeleteSelected">Delete</button>
    </div>
    <div v-if="selectMode && showBulkCats" class="pv-bulk-cats" @wheel.prevent="onChipRowWheel">
      <button
        v-for="cat in activeCategories" :key="cat.id"
        class="pv-chip"
        @click="bulkMoveSelected(cat.id)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" :stroke="cat.color" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <path :d="iconPathFor(cat.icon)" />
        </svg>
        {{ cat.name }}
      </button>
    </div>

    <!-- Pull-to-refresh indicator -->
    <div v-if="pullDistance > 0 || refreshing" class="pv-pull-indicator" :style="{ height: pullDistance + 'px' }">
      <div :class="['pv-pull-spinner', { active: pullDistance > 50 || refreshing }]"></div>
    </div>

    <!-- Places list -->
    <div class="pv-list" ref="listEl" @touchstart.passive="onPullStart" @touchmove.passive="onPullMove" @touchend="onPullEnd">
      <!-- Skeleton loading cards -->
      <div v-if="!activePlaces.length" class="pv-skeletons">
        <div v-for="i in 4" :key="i" class="pv-skeleton-card">
          <div class="sk-dot"></div>
          <div class="sk-body"><div class="sk-line w70"></div><div class="sk-line w40"></div><div class="sk-line w90"></div></div>
        </div>
      </div>

      <div v-if="sortedPlaces.length === 0 && activePlaces.length" class="pv-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.2">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        <p>{{ search ? 'No matching places' : 'No places saved yet' }}</p>
      </div>

      <button
        v-for="place in displayedPlaces" :key="place.id"
        :class="['pv-card', 'contain-item', { selected: selectMode && selectedIds.has(place.id), selecting: selectMode }]"
        @click="onCardClick(place)"
        @touchstart.passive="onCardPressStart($event, place)"
        @touchend="onCardPressEnd"
        @touchcancel="onCardPressEnd"
      >
        <span v-if="selectMode" :class="['pv-check', { on: selectedIds.has(place.id) }]">
          <svg v-if="selectedIds.has(place.id)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
        <div class="pv-card-left">
          <span class="pv-cat-icon" :style="{ background: getCat(place.category).color + '22', color: getCat(place.category).color }">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path :d="iconPathFor(getCat(place.category).icon)" />
            </svg>
          </span>
        </div>
        <div class="pv-card-body">
          <div class="pv-card-top">
            <span class="pv-card-name">{{ place.name }}</span>
            <span v-if="place._dist != null" class="pv-card-dist">{{ formatDistance(place._dist) }}</span>
          </div>
          <div v-if="place.rating" class="pv-card-stars">{{ renderStars(place.rating) }}</div>
          <div class="pv-card-meta">
            <span v-if="place.cuisine && place.cuisine !== 'None'" class="pv-card-cuisine">{{ place.cuisine }}</span>
            <span class="pv-cat-label" :style="getCatStyle(place.category)">{{ getCat(place.category).name }}</span>
          </div>
          <p v-if="place.address" class="pv-card-addr">{{ place.address }}</p>
          <div v-if="place.tags && place.tags.length" class="pv-card-tags">
            <span v-for="t in place.tags.slice(0, 3)" :key="t" class="pv-tag">{{ t }}</span>
            <span v-if="place.tags.length > 3" class="pv-tag-more">+{{ place.tags.length - 3 }}</span>
          </div>
        </div>
        <PlaceCardThumbnail v-if="place.website" :website="place.website" />
        <svg v-else class="pv-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <!-- Sentinel: grows the rendered window as the user scrolls, so
           541 places never get rendered/diffed at once (search/counts
           still run over the FULL list — only DOM rendering is chunked) -->
      <div v-if="displayedPlaces.length < sortedPlaces.length" ref="loadSentinel" class="pv-load-sentinel"></div>
    </div>

    <!-- Context menu overlay -->
    <div v-if="contextMenu.show" class="ctx-overlay" @click="closeContextMenu">
      <div class="ctx-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
        <button @click="contextAction('map')">Show on Map</button>
        <button @click="contextAction('share')">Share</button>
        <button v-if="!friendsStore.viewingFriendId" class="danger" @click="contextAction('delete')">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.places-view {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top);
  padding-bottom: calc(60px + var(--safe-bottom));
}

.pv-friend-banner {
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

.pv-friend-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.pv-friend-close {
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

.pv-header {
  padding: 16px 20px 8px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-shrink: 0;
}

.pv-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, $accent, $accent-hover);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
}

.pv-count {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}

/* Search */
.pv-search-wrap {
  margin: 8px 16px 0;
  position: relative;
  flex-shrink: 0;
}

.pv-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.pv-search {
  width: 100%;
  height: 46px;
  padding: 0 40px 0 44px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 14px;
  border: 1px solid var(--border);
  font-size: 15px;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
  }

  &::placeholder { color: var(--text-muted); }
}

.pv-search-clear {
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

/* Category chips */
.pv-cats {
  display: flex;
  gap: 6px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;

  &::-webkit-scrollbar { display: none; }
}

.pv-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;

  svg { flex-shrink: 0; }
  font-size: 12px;
  border-radius: 20px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  font-weight: 500;
  white-space: nowrap;

  &.active {
    background: var(--accent-light);
    color: var(--accent);
    border-color: rgba($accent, 0.3);
  }
}

/* List */
.pv-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 0 12px 12px;
}

.pv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  gap: 12px;
}

/* Card */
.pv-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  margin-bottom: 6px;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-align: left;
  transition: all 150ms ease;
  box-shadow: var(--shadow), inset 0 1px 0 var(--glass-highlight);

  &:active {
    background: var(--bg-hover);
    transform: scale(0.98);
  }
}

.pv-card-left {
  flex-shrink: 0;
}

.pv-cat-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.pv-cat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;

  svg { display: block; }

  &.small {
    width: 26px;
    height: 26px;
    border-radius: 9px;
    flex-shrink: 0;
  }
}

.pv-card-body {
  flex: 1;
  min-width: 0;
}

.pv-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pv-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pv-card-dist {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 2px 8px;
  border-radius: 8px;
}

.pv-card-stars {
  font-size: 12px;
  color: #f59e0b;
  letter-spacing: 1px;
  margin: 2px 0;
}

.pv-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 0;
}

.pv-card-cuisine {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.pv-cat-label {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.pv-card-addr {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pv-card-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.pv-tag {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.pv-tag-more {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
}

.pv-card-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.5;
}

/* Pull to refresh */
.pv-pull-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: height 0.2s ease;
}

.pv-pull-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  opacity: 0.3;
  transition: opacity 0.2s;

  &.active { opacity: 1; animation: spin 0.6s linear infinite; }
}

@keyframes spin { to { transform: rotate(360deg); } }

/* Context menu */
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.2);
}

.ctx-menu {
  position: absolute;
  min-width: 150px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  -webkit-backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: ctxIn 0.15s ease;

  button {
    display: block;
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
    color: var(--text-primary);
    text-align: left;
    background: none;

    &:active { background: var(--bg-hover); }
    &.danger { color: var(--danger); }
  }
}

@keyframes ctxIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

/* Skeleton cards */
.pv-skeletons { padding: 0 12px; }

.pv-skeleton-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  margin-bottom: 6px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.sk-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--bg-tertiary); flex-shrink: 0; }
.sk-body { flex: 1; display: flex; flex-direction: column; gap: 6px; }

.sk-line {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--bg-glass-light) 25%, var(--bg-hover) 50%, var(--bg-glass-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  &.w70 { width: 70%; }
  &.w40 { width: 40%; }
  &.w90 { width: 90%; }
}

@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
</style>
