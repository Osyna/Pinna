<script setup>
import { ref, computed, watch } from 'vue'
import { usePlacesStore } from '../stores/places'
import { useAuthStore } from '../stores/auth'
import { useLinkPreview } from '../composables/useLinkPreview'
import { hapticTap } from '../composables/useHaptics'
import { api } from '../api.js'
import { ACCENT } from '../theme'

const props = defineProps({
  placeId: { type: String, default: null },
  readonly: { type: Boolean, default: false },
  placesSource: { type: Array, default: null },
})

const emit = defineEmits(['close', 'fly-to'])
const showLoading = ref(false)
const store = usePlacesStore()

const place = computed(() => {
  const source = props.placesSource || store.places
  return source.find(p => p.id === props.placeId) || null
})
const category = computed(() => place.value ? store.getCategoryById(place.value.category) : null)
const canShare = typeof navigator !== 'undefined' && !!navigator.share

const placeWebsite = computed(() => place.value?.website || '')
const { imageUrl: previewImage, loading: previewLoading } = useLinkPreview(placeWebsite)

const isEditing = ref(false)
const editForm = ref({})
const editTagInput = ref('')
const hoverRating = ref(0)
const showDeleteConfirm = ref(false)

// Friends who saved the same place
const authStore = useAuthStore()
const friendMatches = ref([])
const showFriendList = ref(false)
const friendMatchesLoading = ref(false)

async function fetchFriendMatches(p) {
  if (!p || !authStore.isAuthenticated) { friendMatches.value = []; return }
  friendMatchesLoading.value = true
  try {
    const data = await api.get(`/friends/place-matches?lat=${p.lat}&lng=${p.lng}`)
    friendMatches.value = data.friends || []
  } catch {
    friendMatches.value = []
  } finally {
    friendMatchesLoading.value = false
  }
}

watch(place, (p) => {
  showFriendList.value = false
  if (p) fetchFriendMatches(p)
  else friendMatches.value = []
}, { immediate: true })

// Swipe-to-dismiss touch handling
const sheetEl = ref(null)
const dragY = ref(0)
const dragging = ref(false)
let startY = 0
let startScrollTop = 0

function onTouchStart(e) {
  const sheet = sheetEl.value
  if (!sheet) return
  startScrollTop = sheet.scrollTop
  // Only start drag if at top of scroll
  if (startScrollTop > 0) return
  startY = e.touches[0].clientY
  dragging.value = true
  dragY.value = 0
}

function onTouchMove(e) {
  if (!dragging.value) return
  const dy = e.touches[0].clientY - startY
  if (dy < 0) {
    // Scrolling up — stop drag, let native scroll handle it
    dragging.value = false
    dragY.value = 0
    return
  }
  dragY.value = dy
}

function onTouchEnd() {
  if (!dragging.value) return
  dragging.value = false
  if (dragY.value > 100) {
    // Dismiss
    hapticTap()
    emit('close')
  }
  dragY.value = 0
}

watch(() => props.placeId, () => {
  isEditing.value = false
  showDeleteConfirm.value = false
  showLoading.value = false
  showFriendList.value = false
})

function startEdit() {
  editForm.value = {
    ...place.value,
    tags: place.value.tags ? [...place.value.tags] : [],
  }
  isEditing.value = true
}

function saveEdit() {
  store.updatePlace(props.placeId, editForm.value)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function deletePlace() {
  store.removePlace(props.placeId)
  emit('close')
}

function addEditTag() {
  const tag = editTagInput.value.trim().toLowerCase()
  if (tag && !editForm.value.tags.includes(tag)) {
    editForm.value.tags.push(tag)
  }
  editTagInput.value = ''
}

function removeEditTag(tag) {
  editForm.value.tags = editForm.value.tags.filter(t => t !== tag)
}

function setEditRating(val) {
  editForm.value.rating = editForm.value.rating === val ? 0 : val
}

function renderStars(rating) {
  return rating > 0 ? '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating) : ''
}

function openDirections() {
  if (!place.value) return
  // Google Maps directions URL — opens natively on mobile
  const url = `https://www.google.com/maps/dir/?api=1&destination=${place.value.lat},${place.value.lng}&destination_place_id=&travelmode=driving`
  window.open(url, '_blank')
}

function openInMaps() {
  if (!place.value) return
  const url = `https://www.google.com/maps/search/?api=1&query=${place.value.lat},${place.value.lng}`
  window.open(url, '_blank')
}

function sharePlace() {
  if (!place.value || !navigator.share) return
  navigator.share({
    title: place.value.name,
    text: `${place.value.name} - ${place.value.address || ''}`,
    url: `https://www.google.com/maps/search/?api=1&query=${place.value.lat},${place.value.lng}`,
  }).catch(() => {})
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div v-if="place" class="detail-overlay" @click.self="$emit('close')">
    <div class="detail-sheet"
      ref="sheetEl"
      :style="dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : '' } : {}"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- Handle -->
      <div class="sheet-handle">
        <div class="handle-bar"></div>
      </div>

      <!-- Preview hero image -->
      <div v-if="previewLoading" class="preview-hero-skeleton"></div>
      <img v-else-if="previewImage" :src="previewImage" class="preview-hero-img" alt="" />

      <!-- Hero header with colored accent -->
      <div class="detail-hero" :style="{ '--cat-color': category?.color || ACCENT }">
        <div class="hero-accent"></div>
        <div class="hero-content">
          <div class="hero-top">
            <div class="cat-pill" :style="{ background: (category?.color || ACCENT) + '25', color: category?.color }">
              <span class="cat-dot" :style="{ background: category?.color }"></span>
              {{ category?.name }}
            </div>
            <button class="close-btn" @click="hapticTap(); $emit('close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <h2 class="place-name">{{ place.name }}</h2>

          <!-- Rating -->
          <div v-if="place.rating" class="place-rating">
            <span class="stars">{{ renderStars(place.rating) }}</span>
            <span class="rating-num">{{ place.rating }}/5</span>
          </div>

          <!-- Cuisine badge -->
          <div v-if="place.cuisine && place.cuisine !== 'None'" class="cuisine-badge">
            {{ place.cuisine }}
          </div>

          <!-- Friends who saved this place -->
          <div v-if="friendMatches.length > 0" class="friend-match">
            <button v-if="friendMatches.length <= 2" class="friend-match-pill" @click="showFriendList = !showFriendList">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <span>{{ friendMatches.map(f => f.name?.split(' ')[0] || f.handle).join(' & ') }} saved this too</span>
            </button>
            <button v-else class="friend-match-pill" @click="showFriendList = !showFriendList">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span>{{ friendMatches.length }} friends saved this</span>
              <svg :class="['friend-match-chevron', { open: showFriendList }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <transition name="fm-expand">
              <div v-if="showFriendList && friendMatches.length > 2" class="friend-match-list">
                <div v-for="f in friendMatches" :key="f.id" class="friend-match-item">
                  <div class="friend-match-avatar">{{ (f.name || f.handle || '?')[0].toUpperCase() }}</div>
                  <div class="friend-match-info">
                    <span class="friend-match-name">{{ f.name || f.handle }}</span>
                    <span v-if="f.handle" class="friend-match-handle">@{{ f.handle }}</span>
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- View mode -->
      <div v-if="!isEditing" class="detail-body">
        <!-- Quick actions -->
        <div class="quick-actions">
          <button class="action-card" @click="hapticTap(); openDirections()">
            <div class="action-icon directions">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </div>
            <span>Directions</span>
          </button>
          <button class="action-card" @click="hapticTap(); openInMaps()">
            <div class="action-icon maps">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
            </div>
            <span>Google Maps</span>
          </button>
          <button class="action-card" @click="hapticTap(); showLoading = true; $emit('fly-to', place)">
            <div :class="['action-icon', 'show', { loading: showLoading }]">
              <svg v-if="!showLoading" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <div v-else class="action-spinner"></div>
            </div>
            <span>Show</span>
          </button>
          <button v-if="canShare" class="action-card" @click="hapticTap(); sharePlace()">
            <div class="action-icon share">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </div>
            <span>Share</span>
          </button>
        </div>

        <!-- Info sections -->
        <div class="info-sections">
          <!-- Address -->
          <div v-if="place.address" class="info-row">
            <div class="info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">Address</span>
              <span class="info-value">{{ place.address }}</span>
            </div>
          </div>

          <!-- Coordinates -->
          <div class="info-row">
            <div class="info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">Coordinates</span>
              <span class="info-value mono">{{ place.lat.toFixed(5) }}, {{ place.lng.toFixed(5) }}</span>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="place.notes" class="info-row">
            <div class="info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">Notes</span>
              <span class="info-value">{{ place.notes }}</span>
            </div>
          </div>

          <!-- Added date -->
          <div v-if="place.createdAt" class="info-row">
            <div class="info-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div class="info-text">
              <span class="info-label">Added</span>
              <span class="info-value">{{ formatDate(place.createdAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="place.tags && place.tags.length" class="tags-section">
          <span class="tags-label">Tags</span>
          <div class="tags-list">
            <span v-for="tag in place.tags" :key="tag" class="tag-pill">{{ tag }}</span>
          </div>
        </div>

        <!-- Bottom actions -->
        <div v-if="!readonly" class="detail-actions">
          <button class="btn-edit" @click="startEdit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="btn-delete" @click="showDeleteConfirm = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Delete
          </button>
        </div>

        <!-- Delete confirmation -->
        <div v-if="showDeleteConfirm && !readonly" class="delete-confirm">
          <p>Delete <strong>{{ place.name }}</strong>?</p>
          <div class="confirm-btns">
            <button class="btn-confirm-delete" @click="deletePlace">Yes, delete</button>
            <button class="btn-confirm-cancel" @click="showDeleteConfirm = false">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else class="detail-body edit-mode">
        <div class="edit-field">
          <label>Name</label>
          <input v-model="editForm.name" type="text" placeholder="Place name" />
        </div>

        <div class="edit-field">
          <label>Address</label>
          <input v-model="editForm.address" type="text" placeholder="Address" />
        </div>

        <div class="edit-row">
          <div class="edit-field">
            <label>Category</label>
            <select v-model="editForm.category">
              <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
          </div>
          <div class="edit-field">
            <label>Cuisine</label>
            <select v-model="editForm.cuisine">
              <option v-for="c in store.cuisineTypes" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <div class="edit-field">
          <label>Rating</label>
          <div class="star-rating">
            <button
              v-for="i in 5" :key="i"
              class="star-btn"
              @click="setEditRating(i)"
              @mouseenter="hoverRating = i"
              @mouseleave="hoverRating = 0"
            >
              <svg width="26" height="26" viewBox="0 0 24 24"
                :fill="i <= (hoverRating || editForm.rating || 0) ? '#f59e0b' : 'none'"
                :stroke="i <= (hoverRating || editForm.rating || 0) ? '#f59e0b' : 'currentColor'"
                stroke-width="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
            <span v-if="editForm.rating" class="rating-label">{{ editForm.rating }}/5</span>
          </div>
        </div>

        <div class="edit-field">
          <label>Tags</label>
          <div class="tags-edit-wrap">
            <div v-if="editForm.tags?.length" class="edit-tags-list">
              <span v-for="tag in editForm.tags" :key="tag" class="edit-tag">
                {{ tag }}
                <button @click="removeEditTag(tag)">&times;</button>
              </span>
            </div>
            <input v-model="editTagInput" type="text" placeholder="Add tag + Enter" @keyup.enter="addEditTag" />
          </div>
        </div>

        <div class="edit-field">
          <label>Notes</label>
          <textarea v-model="editForm.notes" placeholder="Notes..." rows="3"></textarea>
        </div>

        <div class="edit-field">
          <label>Website</label>
          <input v-model="editForm.website" type="url" placeholder="https://..." />
        </div>

        <div class="edit-actions">
          <button class="btn-save" @click="saveEdit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Save Changes
          </button>
          <button class="btn-cancel" @click="cancelEdit">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* ─── Preview hero image ─── */
.preview-hero-skeleton {
  width: 100%;
  height: 180px;
  background: linear-gradient(90deg, var(--bg-glass-light) 25%, var(--bg-hover) 50%, var(--bg-glass-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.preview-hero-img {
  width: 100%;
  max-height: 180px;
  object-fit: cover;
  display: block;
}

/* ─── Overlay ─── */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: overlayIn 0.25s ease;
}

@keyframes overlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.detail-sheet {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  background: var(--bg-glass);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid var(--border-light);
  border-bottom: none;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: 0 -8px 60px rgba(0, 0, 0, 0.5);
  animation: sheetUp 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  padding-bottom: calc(var(--safe-bottom) + 16px);
}

@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Handle */
.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 2px;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* ─── Hero ─── */
.detail-hero {
  position: relative;
  padding: 4px 22px 20px;
  overflow: hidden;
}

.hero-accent {
  position: absolute;
  top: -30px;
  right: -20px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: var(--cat-color);
  opacity: 0.06;
  filter: blur(30px);
}

.hero-content {
  position: relative;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border-radius: 50%;
  border: 1px solid var(--border);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.place-name {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.place-rating {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.stars {
  color: #f59e0b;
  font-size: 18px;
  letter-spacing: 2px;
}

.rating-num {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.cuisine-badge {
  display: inline-block;
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-light);
  padding: 4px 14px;
  border-radius: 14px;
  font-weight: 600;
}

/* ─── Friend matches ─── */
.friend-match { margin-top: 10px; }

.friend-match-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(249, 115, 22, 0.1);
  border: 1px solid rgba(249, 115, 22, 0.2);
  color: #f97316;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  transition: all var(--transition);

  &:active { transform: scale(0.97); }
}

.friend-match-chevron {
  transition: transform 0.2s ease;

  &.open { transform: rotate(180deg); }
}

.friend-match-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  padding: 6px;
  background: var(--bg-secondary);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
}

.friend-match-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;

  &:hover { background: var(--bg-tertiary); }
}

.friend-match-avatar {
  width: 30px;
  height: 30px;
  background: linear-gradient(135deg, #f97316, #fb923c);
  color: white;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.friend-match-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.friend-match-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.friend-match-handle {
  font-size: 11px;
  color: var(--text-muted);
}

.fm-expand-enter-active { animation: fmExpand 0.2s ease; }
.fm-expand-leave-active { animation: fmExpand 0.15s ease reverse; }

@keyframes fmExpand {
  from { opacity: 0; max-height: 0; transform: translateY(-4px); }
  to { opacity: 1; max-height: 300px; transform: translateY(0); }
}

/* ─── Quick Actions ─── */
.quick-actions {
  display: flex;
  gap: 8px;
  padding: 0 22px 16px;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.action-card {
  flex: 1;
  min-width: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  transition: all var(--transition);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border-light);
  }

  &:active { transform: scale(0.95); }
}

.action-icon {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);

  &.directions {
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
  }

  &.maps {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }

  &.show {
    background: var(--accent-light);
    color: var(--accent);
  }

  &.loading {
    background: var(--accent);
  }

  &.share {
    background: rgba(249, 115, 22, 0.12);
    color: #f97316;
  }
}

.action-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: detailSpin 0.6s linear infinite;
}

@keyframes detailSpin { to { transform: rotate(360deg); } }

/* ─── Info sections ─── */
.info-sections {
  padding: 0 22px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);

  &:last-child { border-bottom: none; }
}

.info-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background: var(--bg-glass-light);
  border-radius: var(--radius-sm);
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.info-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;

  &.mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    color: var(--text-secondary);
  }
}

/* ─── Tags ─── */
.tags-section {
  padding: 8px 22px 16px;
}

.tags-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-pill {
  padding: 5px 14px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

/* ─── Actions ─── */
.detail-actions {
  display: flex;
  gap: 10px;
  padding: 12px 22px;
  border-top: 1px solid var(--border);
}

.btn-edit {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba($accent, 0.15);

  &:hover {
    background: var(--accent);
    color: white;
  }
}

.btn-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  border: 1px solid rgba(239, 68, 68, 0.1);

  &:hover { background: rgba(239, 68, 68, 0.15); }
}

/* Delete confirm */
.delete-confirm {
  margin: 0 22px 8px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: var(--radius);
  text-align: center;

  p {
    font-size: 14px;
    margin-bottom: 12px;
    color: var(--text-secondary);
  }
}

.confirm-btns {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.btn-confirm-delete {
  padding: 10px 20px;
  background: var(--danger);
  color: white;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
}

.btn-confirm-cancel {
  padding: 10px 20px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: var(--radius);
  font-size: 14px;
}

/* ─── Edit mode ─── */
.edit-mode {
  padding: 8px 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input,
  select,
  textarea {
    padding: 12px 14px;
    background: var(--bg-glass-light);
    color: var(--text-primary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    font-size: 15px;
    -webkit-appearance: none;

    &:focus {
      @include input-focus;
    }
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-muted);
  }
}

.edit-row {
  display: flex;
  gap: 10px;

  .edit-field { flex: 1; }
}

.star-rating {
  display: flex;
  align-items: center;
  gap: 2px;
}

.star-btn {
  background: none;
  padding: 4px;
  color: var(--text-muted);
  display: flex;

  &:active { transform: scale(1.2); }
}

.rating-label {
  margin-left: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.tags-edit-wrap {
  padding: 10px 12px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:focus-within {
    @include input-focus;
  }

  input {
    background: none;
    border: none;
    padding: 4px;
    color: var(--text-primary);
    font-size: 14px;

    &:focus { box-shadow: none; }
  }
}

.edit-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.edit-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 12px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;

  button {
    background: none;
    color: var(--accent);
    font-size: 16px;
    padding: 0;
    line-height: 1;
  }
}

.edit-actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}

.btn-save {
  flex: 2;
  @include btn-primary;
  font-size: 15px;
}

.btn-cancel {
  flex: 1;
  padding: 14px 16px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 15px;
}

/* ─── Desktop ─── */
@media (min-width: 769px) {
  .detail-overlay {
    align-items: center;
  }

  .detail-sheet {
    border-radius: var(--radius-xl);
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 16px;
    max-height: 85vh;
    animation-name: scaleIn;
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .sheet-handle {
    display: none;
  }
}
</style>
