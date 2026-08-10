<script setup>
import { ref, computed, onMounted, watch, nextTick, defineAsyncComponent } from 'vue'
import MapView from './components/MapView.vue'
import SearchBar from './components/SearchBar.vue'
import SearchView from './components/SearchView.vue'
import PlacesView from './components/PlacesView.vue'
import ProfileView from './components/ProfileView.vue'
import FriendsView from './components/FriendsView.vue'
const AddPlaceModal = defineAsyncComponent(() => import('./components/AddPlaceModal.vue'))
import PlaceDetail from './components/PlaceDetail.vue'
const AuthModal = defineAsyncComponent(() => import('./components/AuthModal.vue'))
import AppToast from './components/AppToast.vue'
import InstallPwaSheet from './components/InstallPwaSheet.vue'
import { usePwaInstall } from './composables/usePwaInstall'
import SplashScreen from './components/SplashScreen.vue'
import { useAuthStore } from './stores/auth'
import { usePlacesStore } from './stores/places'
import { useFriendsStore } from './stores/friends'
import { useTheme } from './composables/useTheme'
import { hapticSelect } from './composables/useHaptics'

const addPlaceModal = ref({ show: false, lat: 0, lng: 0, address: '', name: '', category: '', cuisine: '', tags: [], website: '' })
const mapRef = ref(null)
const activeTab = ref('map')
const detailPlaceId = ref(null)

/* ── Smooth tab transitions + navbar swipe ── */
const TAB_ORDER = ['map', 'search', 'places', 'friends', 'profile']
function effectiveTab(tab) {
  // Viewing a friend's map keeps the URL/tab at 'map' but visually belongs to 'friends'
  return (tab === 'map' && friendsStore.viewingFriendId) ? 'friends' : tab
}
const slideDirection = ref('next')
watch(activeTab, (next, prev) => {
  const a = TAB_ORDER.indexOf(effectiveTab(prev))
  const b = TAB_ORDER.indexOf(effectiveTab(next))
  slideDirection.value = b >= a ? 'next' : 'prev'
})
const viewTransitionName = computed(() => `view-slide-${slideDirection.value}`)

function goAdjacentTab(delta) {
  const idx = TAB_ORDER.indexOf(effectiveTab(activeTab.value))
  const nextIdx = Math.min(TAB_ORDER.length - 1, Math.max(0, idx + delta))
  const nextTab = TAB_ORDER[nextIdx]
  if (nextTab !== effectiveTab(activeTab.value)) switchTab(nextTab)
}

// Swipe left/right ON the tab bar to move to the next/previous view
let tabSwipeStartX = 0
let tabSwipeStartY = 0
let tabSwipeDeltaX = 0
let tabSwiping = false
const SWIPE_THRESHOLD = 40

function onTabsTouchStart(e) {
  const t = e.touches[0]
  tabSwipeStartX = t.clientX
  tabSwipeStartY = t.clientY
  tabSwipeDeltaX = 0
  tabSwiping = false
}
function onTabsTouchMove(e) {
  const t = e.touches[0]
  const dx = t.clientX - tabSwipeStartX
  const dy = t.clientY - tabSwipeStartY
  if (!tabSwiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
    tabSwiping = true
  }
  if (tabSwiping) tabSwipeDeltaX = dx
}
function onTabsTouchEnd(e) {
  if (tabSwiping) {
    // Swallow the synthetic click a swipe would otherwise fire on the
    // button under the finger (would switch to a random adjacent tab)
    e.preventDefault()
    if (tabSwipeDeltaX <= -SWIPE_THRESHOLD) goAdjacentTab(1)
    else if (tabSwipeDeltaX >= SWIPE_THRESHOLD) goAdjacentTab(-1)
  }
  tabSwiping = false
  tabSwipeDeltaX = 0
}

const isOffline = ref(!navigator.onLine)
const showSplash = ref(true)
const splashFinished = ref(false)

const appVisible = computed(() => !showSplash.value && splashFinished.value)

const tabIndicatorStyle = computed(() => {
  const tabIndices = { map: 0, search: 1, places: 2, friends: 3, profile: 4 }
  // When viewing a friend's map, highlight the friends tab instead of map
  const effectiveTab = (activeTab.value === 'map' && friendsStore.viewingFriendId) ? 'friends' : activeTab.value
  const index = tabIndices[effectiveTab] ?? 0
  return { left: `calc(${index * 20}% + 10% - 12px)` }
})

const authStore = useAuthStore()
const placesStore = usePlacesStore()
const friendsStore = useFriendsStore()
const { initTheme } = useTheme()
const { maybeAutoShow: maybeShowInstallPrompt } = usePwaInstall()

onMounted(async () => {
  initTheme()
  window.addEventListener('online', () => isOffline.value = false)
  window.addEventListener('offline', () => isOffline.value = true)
  await authStore.init()
  if (authStore.isAuthenticated) {
    await placesStore.fetchPlaces()
    await placesStore.fetchCategories()
    placesStore.fetchLists()
    friendsStore.fetchFriends()
    friendsStore.fetchRequests()
  }
})

watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await placesStore.fetchPlaces()
    await placesStore.fetchCategories()
    placesStore.fetchLists()
    friendsStore.fetchFriends()
    friendsStore.fetchRequests()
  } else {
    friendsStore.reset()
  }
})

function onAddPlace(data) {
  addPlaceModal.value = {
    show: true, lat: data.lat, lng: data.lng,
    address: data.address || '', name: data.name || '',
    category: data.category || '', cuisine: data.cuisine || '',
    tags: data.tags || [], website: data.website || '',
  }
}

async function onSearchSelect(result) {
  activeTab.value = 'map'
  await nextTick()
  if (result.isSaved) {
    if (mapRef.value) mapRef.value.clearTempPin()
    if (mapRef.value) mapRef.value.flyTo(result.lat, result.lng, 16)
    detailPlaceId.value = result.id
  } else {
    if (mapRef.value) mapRef.value.showTempPin({
      lat: result.lat, lng: result.lng,
      name: result.name, address: result.fullName || result.address || '',
      website: result.website || '',
    })
  }
}

function onShowDetail(place) {
  if (mapRef.value) mapRef.value.clearTempPin()
  detailPlaceId.value = place.id
  // Smart zoom to place on map
  if (mapRef.value) mapRef.value.smartFlyTo(place.lat, place.lng)
}

async function onDetailFlyTo(place) {
  activeTab.value = 'map'
  await nextTick()
  // Close the detail card after a brief moment to show the loading state
  setTimeout(() => { detailPlaceId.value = null }, 350)
  if (mapRef.value) {
    mapRef.value.flyTo(place.lat, place.lng, 17)
    // Show the pin preview popup after the fly animation
    setTimeout(() => {
      if (mapRef.value) mapRef.value.showPlacePreview(place)
    }, 900)
  }
}



function closeAddModal() { addPlaceModal.value.show = false }

async function onViewFriendMap(friendId) {
  await friendsStore.viewFriendPlaces(friendId)
  activeTab.value = 'map'
  await nextTick()
  // Fit map to friend's places if available
  if (friendsStore.viewingFriendPlaces.length && mapRef.value) {
    const first = friendsStore.viewingFriendPlaces[0]
    mapRef.value.flyTo(first.lat, first.lng, 12)
  }
}

function switchTab(tab) {
  hapticSelect()
  if (tab === 'map') detailPlaceId.value = null
  activeTab.value = tab
}

function onSplashFinish() {
  splashFinished.value = true
  // Smallest possible tick to ensure splashFinished state propagates before showSplash fades
  setTimeout(() => {
    showSplash.value = false
  }, 10)
  // Give the app a moment to feel settled before nudging toward installing it
  setTimeout(() => {
    maybeShowInstallPrompt()
  }, 1600)
}
</script>

<template>
  <div class="app-shell">
    <SplashScreen 
      v-if="showSplash" 
      :is-visible="showSplash"
      :loading="authStore.loading"
      @finish="onSplashFinish" 
    />
    
    <div class="app-root" :class="{ 'pre-reveal': !splashFinished }">
      <!-- Map (Always rendered, but UI elements inside animate) -->
      <Transition :name="viewTransitionName">
        <div v-show="activeTab === 'map'" class="map-layer">
          <MapView
            ref="mapRef"
            :splash-finished="splashFinished"
            @show-detail="onShowDetail"
            @add-place="onAddPlace"
          />
          <SearchBar
            v-if="!showSplash"
            :map-ref="mapRef"
            :class="{ 'build-anim build-anim--drop build-anim--delay-1': splashFinished }"
            @select="onSearchSelect"
          />
        </div>
      </Transition>

      <div v-if="!showSplash" class="main-content-layer">
        <AuthModal v-if="!authStore.isAuthenticated && !authStore.loading" />
        <div v-else-if="authStore.isAuthenticated" class="tab-content-wrapper">
          <Transition :name="viewTransitionName">
            <!-- Search view -->
            <SearchView
              v-if="activeTab === 'search'"
              key="search"
              @show-detail="onShowDetail"
              @select="onSearchSelect"
              @add-place="onAddPlace"
            />

            <!-- Places view -->
            <PlacesView
              v-else-if="activeTab === 'places'"
              key="places"
              @show-detail="onShowDetail"
              @add-place="onAddPlace"
            />

            <!-- Friends view -->
            <FriendsView
              v-else-if="activeTab === 'friends'"
              key="friends"
              @view-friend-map="onViewFriendMap"
            />

            <!-- Profile view -->
            <ProfileView v-else-if="activeTab === 'profile'" key="profile" />
          </Transition>
        </div>
      </div>

      <!-- Offline banner -->
      <transition name="offline">
        <div v-if="isOffline" class="offline-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          <span>No connection</span>
        </div>
      </transition>

      <!-- Bottom tab bar (swipe left/right to move to the next/previous view) -->
      <div
        v-if="!showSplash"
        class="bottom-tabs line-anim"
        @touchstart.passive="onTabsTouchStart"
        @touchmove.passive="onTabsTouchMove"
        @touchend="onTabsTouchEnd"
      >
        <div class="tab-indicator" :style="tabIndicatorStyle"></div>
        <button :class="['tab-btn', 'tab--map', { active: activeTab === 'map' && !friendsStore.viewingFriendId }, { 'build-anim build-anim--slide build-anim--delay-1': splashFinished }]" aria-label="Map" @click="switchTab('map')">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          <span>Map</span>
        </button>
        <button :class="['tab-btn', 'tab--search', { active: activeTab === 'search' }, { 'build-anim build-anim--slide build-anim--delay-2': splashFinished }]" aria-label="Search" @click="switchTab('search')">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Search</span>
        </button>
        <button :class="['tab-btn', 'tab--places', { active: activeTab === 'places' }, { 'build-anim build-anim--slide build-anim--delay-3': splashFinished }]" aria-label="My Places" @click="switchTab('places')">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
          <span>Places</span>
        </button>
        <button :class="['tab-btn', 'tab--friends', { active: activeTab === 'friends' || friendsStore.viewingFriendId }, { 'build-anim build-anim--slide build-anim--delay-4': splashFinished }]" aria-label="Friends" @click="switchTab('friends')" style="position: relative">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <span>Friends</span>
          <span v-if="friendsStore.pendingCount > 0" class="tab-badge">{{ friendsStore.pendingCount }}</span>
        </button>
        <button :class="['tab-btn', 'tab--profile', { active: activeTab === 'profile' }, { 'build-anim build-anim--slide build-anim--delay-4': splashFinished }]" aria-label="Profile" @click="switchTab('profile')">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Profile</span>
        </button>
      </div>

      <!-- Place detail sheet (overlay on any tab) -->
      <PlaceDetail
        :place-id="detailPlaceId"
        :readonly="!!friendsStore.viewingFriendId"
        :places-source="friendsStore.viewingFriendId ? friendsStore.viewingFriendPlaces : null"
        @close="detailPlaceId = null"
        @fly-to="onDetailFlyTo"
      />

      <!-- Add place modal -->
      <AddPlaceModal
        v-if="addPlaceModal.show"
        :lat="addPlaceModal.lat"
        :lng="addPlaceModal.lng"
        :initial-address="addPlaceModal.address"
        :initial-name="addPlaceModal.name"
        :initial-category="addPlaceModal.category"
        :initial-cuisine="addPlaceModal.cuisine"
        :initial-tags="addPlaceModal.tags"
        :initial-website="addPlaceModal.website"
        @close="closeAddModal"
      />
    </div>
    <AppToast />
    <InstallPwaSheet />
  </div>
</template>

<style scoped lang="scss">
.auth-loading {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--bg-primary);

  &-text {
    font-size: 28px; font-weight: 700; color: $accent;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  }
}

.app-shell { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--bg-primary); }
.app-root { position: relative; width: 100%; height: 100%; overflow: hidden; }
.map-layer { position: absolute; inset: 0; z-index: 1; }

// ─── Smooth cross-tab transitions ───
// Both the map layer and the tab-content-wrapper's view share these same
// class names (bound to the same computed direction), so switching to/from
// the map tab feels like one continuous motion even though the map is a
// permanently-mounted v-show element and the other views mount/unmount.
.view-slide-next-enter-active,
.view-slide-next-leave-active,
.view-slide-prev-enter-active,
.view-slide-prev-leave-active {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease;
}

.view-slide-next-enter-from { transform: translateX(18px); opacity: 0; }
.view-slide-next-leave-to { transform: translateX(-14px); opacity: 0; }
.view-slide-prev-enter-from { transform: translateX(-18px); opacity: 0; }
.view-slide-prev-leave-to { transform: translateX(14px); opacity: 0; }

// Reduced motion: keep it a simple, fast crossfade
@media (prefers-reduced-motion: reduce) {
  .view-slide-next-enter-active,
  .view-slide-next-leave-active,
  .view-slide-prev-enter-active,
  .view-slide-prev-leave-active {
    transition: opacity 0.15s ease;
  }
  .view-slide-next-enter-from,
  .view-slide-next-leave-to,
  .view-slide-prev-enter-from,
  .view-slide-prev-leave-to {
    transform: none;
  }
}

// Bottom tab bar
.bottom-tabs {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 1100;
  display: flex; align-items: stretch; justify-content: space-around;
  background: var(--bg-glass); backdrop-filter: var(--blur-heavy); -webkit-backdrop-filter: var(--blur-heavy);
  border-top: 1px solid var(--glass-border);
  padding-bottom: var(--safe-bottom); height: calc(64px + var(--safe-bottom));
  box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.2);
}

.tab-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding: 8px 4px; background: transparent;
  color: var(--text-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.3px;
  transition: color 0.25s var(--ease-out); position: relative;

  &.active { color: $accent; }
  &:active { transform: none; opacity: 0.7; }

  svg {
    width: 24px;
    height: 24px;
    transition: color 0.25s var(--ease-out);
  }
}

.tab-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 20px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--danger);
  color: white;
  font-size: 9px;
  font-weight: 700;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(248, 113, 113, 0.4);
}

// Sliding tab indicator
.tab-indicator {
  position: absolute;
  top: 0;
  width: 24px;
  height: 3px;
  background: $accent;
  border-radius: 0 0 3px 3px;
  transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 12px var(--glow-accent);
}

// Offline banner
.offline-banner {
  position: fixed;
  bottom: calc(60px + var(--safe-bottom) + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1101;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--danger);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.offline-enter-active { animation: toastIn 0.3s ease; }
.offline-leave-active { animation: toastIn 0.2s ease reverse; }

@keyframes offlineFade {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (min-width: 769px) {
  .bottom-tabs {
    max-width: 420px; left: 50%; transform: translateX(-50%);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border: 1px solid var(--glass-border); border-bottom: none;
  }
}

</style>
