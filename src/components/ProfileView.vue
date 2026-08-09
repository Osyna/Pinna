<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePlacesStore } from '../stores/places'
import { useFriendsStore } from '../stores/friends'
import { showToast } from '../composables/useToast'

const authStore = useAuthStore()
const placesStore = usePlacesStore()
const friendsStore = useFriendsStore()

const editing = ref(false)
const saving = ref(false)
const profileError = ref('')
const avatarLoaded = ref(false)
const avatarUploading = ref(false)
const fileInput = ref(null)
const importFileRef = ref(null)
const importStatus = ref('')

// Form state (only used in edit mode)
const name = ref('')
const handle = ref('')
const handleStatus = ref('')
const bio = ref('')
const country = ref('')
const favCuisines = ref([])
const favPlaceIds = ref([])

// Password
const showPwSection = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const pwError = ref('')

// Place picker
const showPlacePicker = ref(false)
const placeSearch = ref('')

const COUNTRIES = [
  'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Canada', 'Chile', 'China', 'Colombia',
  'Czech Republic', 'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'India',
  'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands',
  'New Zealand', 'Nigeria', 'Norway', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Romania',
  'Singapore', 'South Africa', 'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand',
  'Turkey', 'UAE', 'UK', 'USA', 'Vietnam',
]

let handleCheckTimer = null

watch(handle, (val) => {
  if (!editing.value) return
  if (val === (authStore.user?.handle || '')) {
    handleStatus.value = ''
    return
  }
  if (!val || val.length < 3) {
    handleStatus.value = val ? 'invalid' : ''
    return
  }
  if (!/^[a-z0-9_]{3,20}$/.test(val)) {
    handleStatus.value = 'invalid'
    return
  }
  handleStatus.value = 'checking'
  clearTimeout(handleCheckTimer)
  handleCheckTimer = setTimeout(async () => {
    try {
      const available = await authStore.checkHandle(val)
      handleStatus.value = available ? 'available' : 'taken'
    } catch {
      handleStatus.value = ''
    }
  }, 400)
})

const user = computed(() => authStore.user)
const initial = computed(() => {
  const n = user.value?.name || user.value?.email || '?'
  return n.charAt(0).toUpperCase()
})
const avatarUrl = computed(() => authStore.getAvatarUrl(user.value?.id))
const memberSince = computed(() => {
  if (!user.value?.createdAt) return ''
  const d = new Date(user.value.createdAt)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

const displayFavCuisines = computed(() => user.value?.favoriteCuisines || [])
const displayFavPlaces = computed(() =>
  (user.value?.favoritePlaceIds || []).map(id => placesStore.places.find(p => p.id === id)).filter(Boolean)
)

const editFavPlaces = computed(() =>
  favPlaceIds.value.map(id => placesStore.places.find(p => p.id === id)).filter(Boolean)
)

const filteredPickerPlaces = computed(() => {
  const q = placeSearch.value.toLowerCase()
  return placesStore.places
    .filter(p => !favPlaceIds.value.includes(p.id))
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .slice(0, 20)
})

function startEditing() {
  const u = user.value
  if (!u) return
  name.value = u.name || ''
  handle.value = u.handle || ''
  bio.value = u.bio || ''
  country.value = u.country || ''
  favCuisines.value = u.favoriteCuisines ? [...u.favoriteCuisines] : []
  favPlaceIds.value = u.favoritePlaceIds ? [...u.favoritePlaceIds] : []
  handleStatus.value = ''
  profileError.value = ''
  showPlacePicker.value = false
  placeSearch.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  profileError.value = ''
  handleStatus.value = ''
}

async function saveProfile() {
  saving.value = true
  profileError.value = ''
  try {
    const updates = {
      name: name.value,
      bio: bio.value,
      country: country.value,
      favoriteCuisines: favCuisines.value,
      favoritePlaceIds: favPlaceIds.value,
    }
    if (handle.value && handle.value !== (user.value?.handle || '')) {
      updates.handle = handle.value
    }
    await authStore.updateProfile(updates)
    editing.value = false
    showToast('Profile saved!', { type: 'success' })
  } catch (err) {
    profileError.value = err.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  pwError.value = ''
  if (!currentPassword.value || !newPassword.value) {
    pwError.value = 'Fill both fields'
    return
  }
  if (newPassword.value.length < 8) {
    pwError.value = 'Min 8 characters'
    return
  }
  try {
    await authStore.updateProfile({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    showPwSection.value = false
    showToast('Password updated!', { type: 'success' })
  } catch {
    pwError.value = 'Wrong current password'
  }
}

function toggleCuisine(c) {
  const idx = favCuisines.value.indexOf(c)
  if (idx >= 0) {
    favCuisines.value.splice(idx, 1)
  } else if (favCuisines.value.length < 3) {
    favCuisines.value.push(c)
  }
}

function removeFavPlace(id) {
  favPlaceIds.value = favPlaceIds.value.filter(i => i !== id)
}

function addFavPlace(id) {
  if (favPlaceIds.value.length < 3 && !favPlaceIds.value.includes(id)) {
    favPlaceIds.value.push(id)
  }
  showPlacePicker.value = false
  placeSearch.value = ''
}

function copyHandle() {
  const h = '#' + (user.value?.handle || '')
  navigator.clipboard.writeText(h).then(() => {
    showToast('User ID copied!', { type: 'success' })
  }).catch(() => {
    showToast('Could not copy', { type: 'error' })
  })
}

function triggerAvatarUpload() {
  fileInput.value?.click()
}

async function onAvatarSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image', { type: 'error' })
    return
  }
  avatarUploading.value = true
  try {
    const reader = new FileReader()
    const base64 = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await authStore.uploadAvatar(base64)
    avatarLoaded.value = true
    showToast('Avatar updated!', { type: 'success' })
  } catch (err) {
    showToast(err.message || 'Upload failed', { type: 'error' })
  } finally {
    avatarUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function handleImport(event) {
  const files = Array.from(event.target.files)
  if (!files.length) return
  importStatus.value = 'Importing...'
  const { count, error } = await placesStore.importMapstrFiles(files)
  importStatus.value = error || (count > 0 ? `Imported ${count} places` : 'No new places')
  setTimeout(() => { importStatus.value = '' }, 3000)
  event.target.value = ''
}

async function removeAvatar() {
  try {
    await authStore.removeAvatar()
    avatarLoaded.value = false
    showToast('Avatar removed', { type: 'success' })
  } catch {
    showToast('Failed to remove avatar', { type: 'error' })
  }
}
</script>

<template>
  <div class="profile-view">
    <div class="pf-scroll">

      <!-- ===== HERO SECTION ===== -->
      <div class="pf-hero">
        <input ref="fileInput" type="file" accept="image/*" class="pf-file-input" @change="onAvatarSelected" />

        <!-- Avatar: clickable only in edit mode -->
        <button v-if="editing" class="pf-avatar-wrap editable" @click="triggerAvatarUpload" :disabled="avatarUploading">
          <img v-if="avatarUrl" v-show="avatarLoaded" :src="avatarUrl" class="pf-avatar-img" @load="avatarLoaded = true" @error="avatarLoaded = false" />
          <div v-if="!avatarLoaded" class="pf-avatar-fallback">{{ initial }}</div>
          <div class="pf-avatar-overlay" :class="{ uploading: avatarUploading }">
            <svg v-if="!avatarUploading" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <div v-else class="pf-avatar-spin"></div>
          </div>
        </button>
        <div v-else class="pf-avatar-wrap">
          <img v-if="avatarUrl" v-show="avatarLoaded" :src="avatarUrl" class="pf-avatar-img" @load="avatarLoaded = true" @error="avatarLoaded = false" />
          <div v-if="!avatarLoaded" class="pf-avatar-fallback">{{ initial }}</div>
        </div>
        <button v-if="editing && avatarLoaded" class="pf-avatar-remove" @click.stop="removeAvatar">Remove photo</button>

        <h1 class="pf-name">{{ user?.name || 'User' }}</h1>

        <button v-if="user?.handle" class="pf-handle-btn" @click="copyHandle">
          <span>#{{ user.handle }}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>

        <p v-if="user?.bio && !editing" class="pf-bio">{{ user.bio }}</p>
        <p class="pf-email">{{ user?.email }}</p>

        <!-- Edit / Save / Cancel buttons -->
        <div v-if="!editing" class="pf-hero-actions">
          <button class="pf-edit-btn" @click="startEditing">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Profile
          </button>
        </div>
        <div v-else class="pf-hero-actions">
          <button class="pf-cancel-btn" @click="cancelEditing">Cancel</button>
          <button class="pf-save-btn" :disabled="saving" @click="saveProfile">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
        <p v-if="profileError" class="pf-error">{{ profileError }}</p>
      </div>

      <!-- ===== STATS ROW ===== -->
      <div class="pf-stats">
        <div class="pf-stat">
          <span class="pf-stat-num">{{ placesStore.placeCount }}</span>
          <span class="pf-stat-label">Places</span>
        </div>
        <div class="pf-stat-divider"></div>
        <div class="pf-stat">
          <span class="pf-stat-num">{{ friendsStore.friends.length }}</span>
          <span class="pf-stat-label">Friends</span>
        </div>
        <div class="pf-stat-divider"></div>
        <div class="pf-stat">
          <span class="pf-stat-num">{{ memberSince }}</span>
          <span class="pf-stat-label">Joined</span>
        </div>
      </div>

      <!-- ===== READ-ONLY INFO (when NOT editing) ===== -->
      <template v-if="!editing">
        <!-- Country -->
        <div v-if="user?.country" class="pf-section">
          <div class="pf-info-card">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>{{ user.country }}</span>
          </div>
        </div>

        <!-- Favorite Cuisines -->
        <div v-if="displayFavCuisines.length" class="pf-section">
          <h3 class="pf-section-title">Favorite Cuisines</h3>
          <div class="pf-chips-row">
            <span v-for="c in displayFavCuisines" :key="c" class="pf-chip">{{ c }}</span>
          </div>
        </div>

        <!-- Favorite Places -->
        <div v-if="displayFavPlaces.length" class="pf-section">
          <h3 class="pf-section-title">Favorite Places</h3>
          <div class="pf-fav-places">
            <div v-for="place in displayFavPlaces" :key="place.id" class="pf-fav-card">
              <span class="pf-fav-dot" :style="{ background: placesStore.getCategoryById(place.category).color }"></span>
              <div class="pf-fav-info">
                <span class="pf-fav-name">{{ place.name }}</span>
                <span class="pf-fav-cat">{{ placesStore.getCategoryById(place.category).name }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== EDIT MODE FORM ===== -->
      <template v-else>
        <div class="pf-section">
          <div class="pf-field">
            <label>Display Name</label>
            <input v-model="name" type="text" placeholder="Your name" />
          </div>

          <div class="pf-field">
            <label>User ID</label>
            <div class="pf-handle-wrap">
              <span class="pf-handle-prefix">#</span>
              <input v-model="handle" type="text" placeholder="your_id" maxlength="20" class="pf-handle-input" />
              <span v-if="handleStatus === 'checking'" class="pf-handle-status checking">...</span>
              <span v-else-if="handleStatus === 'available'" class="pf-handle-status available">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span v-else-if="handleStatus === 'taken'" class="pf-handle-status taken">Taken</span>
              <span v-else-if="handleStatus === 'invalid'" class="pf-handle-status invalid">3-20 chars, a-z 0-9 _</span>
            </div>
          </div>

          <div class="pf-field">
            <label>Bio</label>
            <textarea v-model="bio" placeholder="Tell us about yourself..." rows="3"></textarea>
          </div>

          <div class="pf-field">
            <label>Country</label>
            <select v-model="country">
              <option value="">Select country</option>
              <option v-for="c in COUNTRIES" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>

        <!-- Favorite Cuisines (edit) -->
        <div class="pf-section">
          <h3 class="pf-section-title">Favorite Cuisines <span class="pf-limit">{{ favCuisines.length }}/3</span></h3>
          <div class="pf-cuisine-grid">
            <button
              v-for="c in placesStore.cuisineTypes.filter(c => c !== 'None')" :key="c"
              :class="['pf-cuisine-chip', { active: favCuisines.includes(c), disabled: !favCuisines.includes(c) && favCuisines.length >= 3 }]"
              @click="toggleCuisine(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>

        <!-- Favorite Places (edit) -->
        <div class="pf-section">
          <h3 class="pf-section-title">Favorite Places <span class="pf-limit">{{ favPlaceIds.length }}/3</span></h3>

          <div v-if="editFavPlaces.length" class="pf-fav-places">
            <div v-for="place in editFavPlaces" :key="place.id" class="pf-fav-card">
              <span class="pf-fav-dot" :style="{ background: placesStore.getCategoryById(place.category).color }"></span>
              <div class="pf-fav-info">
                <span class="pf-fav-name">{{ place.name }}</span>
                <span class="pf-fav-cat">{{ placesStore.getCategoryById(place.category).name }}</span>
              </div>
              <button class="pf-fav-remove" @click="removeFavPlace(place.id)">&times;</button>
            </div>
          </div>

          <button v-if="favPlaceIds.length < 3" class="pf-add-fav-btn" @click="showPlacePicker = !showPlacePicker">
            + Add favorite place
          </button>

          <div v-if="showPlacePicker" class="pf-picker">
            <input v-model="placeSearch" type="text" placeholder="Search places..." class="pf-picker-search" />
            <div class="pf-picker-list">
              <button v-for="p in filteredPickerPlaces" :key="p.id" class="pf-picker-item" @click="addFavPlace(p.id)">
                <span class="pf-fav-dot" :style="{ background: placesStore.getCategoryById(p.category).color }"></span>
                {{ p.name }}
              </button>
              <p v-if="!filteredPickerPlaces.length" class="pf-picker-empty">No places found</p>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== SETTINGS (always visible) ===== -->
      <div class="pf-section">
        <h3 class="pf-section-title">Settings</h3>

        <div class="pf-settings-card">
          <!-- Change password -->
          <button class="pf-setting-row clickable" @click="showPwSection = !showPwSection">
            <div class="pf-setting-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span>Change Password</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" :style="{ transform: showPwSection ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          <div v-if="showPwSection" class="pf-pw-form">
            <div class="pf-field">
              <label>Current Password</label>
              <input v-model="currentPassword" type="password" placeholder="Current password" />
            </div>
            <div class="pf-field">
              <label>New Password</label>
              <input v-model="newPassword" type="password" placeholder="New password (min 8)" />
            </div>
            <p v-if="pwError" class="pf-error">{{ pwError }}</p>
            <button class="pf-pw-save" @click="changePassword">Update Password</button>
          </div>
        </div>
      </div>

      <!-- Data (import/export) -->
      <div class="pf-section">
        <h3 class="pf-section-title">Data</h3>
        <div class="pf-settings-card">
          <button class="pf-setting-row clickable" @click="placesStore.exportPlaces()">
            <span class="pf-setting-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Places
            </span>
          </button>
          <div class="pf-setting-divider"></div>
          <button class="pf-setting-row clickable" @click="importFileRef.click()">
            <span class="pf-setting-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import Places
            </span>
          </button>
          <input ref="importFileRef" type="file" accept=".json,.geojson,.csv" multiple style="display:none" @change="handleImport" />
        </div>
        <div v-if="importStatus" class="pf-import-status">{{ importStatus }}</div>
      </div>

      <!-- Logout -->
      <div class="pf-section pf-logout-section">
        <button class="pf-logout-btn" @click="authStore.logout()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-view {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-primary);
  padding-top: var(--safe-top);
  padding-bottom: calc(60px + var(--safe-bottom));
}

.pf-scroll {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* ===== HERO ===== */
.pf-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 16px;
}

.pf-file-input { display: none; }

.pf-avatar-wrap {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 4px;
  flex-shrink: 0;
  border: 3px solid var(--border);

  &.editable {
    cursor: pointer;
    border-color: var(--accent);

    &:active { transform: scale(0.95); }

    &:hover .pf-avatar-overlay,
    &:active .pf-avatar-overlay { opacity: 1; }
  }
}

.pf-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pf-avatar-fallback {
  width: 100%;
  height: 100%;
  @include avatar-gradient;
  font-size: 32px;
  font-weight: 700;
}

.pf-avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: 50%;

  &.uploading { opacity: 1; }
}

.pf-avatar-spin {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.pf-avatar-remove {
  font-size: 12px;
  color: var(--danger);
  background: none;
  padding: 2px 8px;
  margin-bottom: 2px;
  font-weight: 500;
}

.pf-name {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin-top: 8px;
  letter-spacing: -0.02em;
}

.pf-handle-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  padding: 4px 14px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid rgba($accent, 0.15);
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.95);
    background: var(--accent);
    color: white;
  }
}

.pf-bio {
  margin-top: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
  max-width: 320px;
}

.pf-email {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.pf-hero-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.pf-edit-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: var(--bg-glass-light);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.96);
    background: var(--bg-hover);
  }
}

.pf-cancel-btn {
  padding: 10px 24px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
}

.pf-save-btn {
  padding: 10px 28px;
  background: var(--accent);
  color: white;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;

  &:disabled { opacity: 0.5; }
}

.pf-error {
  margin-top: 8px;
  font-size: 13px;
  color: var(--danger);
  text-align: center;
}

/* ===== STATS ===== */
.pf-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 20px;
  margin: 0 20px 20px;
  background: var(--bg-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow), inset 0 1px 0 var(--glass-highlight);
}

.pf-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.pf-stat-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.pf-stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pf-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border);
}

/* ===== READ-ONLY INFO ===== */
.pf-info-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;

  svg { color: var(--text-muted); flex-shrink: 0; }
}

.pf-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pf-chip {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 20px;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid rgba($accent, 0.15);
  font-weight: 600;
}

/* ===== SECTIONS ===== */
.pf-section {
  padding: 0 20px 20px;
}

.pf-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pf-limit {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}

/* ===== FIELDS (edit mode) ===== */
.pf-field {
  margin-bottom: 14px;

  label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  input,
  select,
  textarea {
    width: 100%;
    padding: 12px 14px;
    background: var(--bg-glass-light);
    color: var(--text-primary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    font-size: 15px;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-light);
    }
  }

  textarea { resize: vertical; min-height: 60px; }

  input::placeholder,
  textarea::placeholder { color: var(--text-muted); }
}

/* Handle edit */
.pf-handle-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-glass-light);
  border-radius: var(--radius);
  border: 1px solid var(--border);

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
  }
}

.pf-handle-prefix {
  padding: 12px 0 12px 14px;
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 600;
}

.pf-handle-input {
  flex: 1;
  background: none !important;
  border: none !important;
  padding: 12px 8px !important;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  min-width: 0;

  &:focus { border: none !important; box-shadow: none !important; }
}

.pf-handle-status {
  padding: 0 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;

  &.checking { color: var(--text-muted); }
  &.available { color: #22c55e; display: flex; }
  &.taken { color: var(--danger); }
  &.invalid { color: var(--text-muted); font-size: 10px; }
}

/* Cuisine grid */
.pf-cuisine-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pf-cuisine-chip {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 20px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  font-weight: 500;

  &.active {
    background: var(--accent-light);
    color: var(--accent);
    border-color: var(--accent-glow);
  }

  &.disabled {
    opacity: 0.35;
    pointer-events: none;
  }
}

/* Favorite places */
.pf-fav-places {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.pf-fav-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.pf-fav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pf-fav-info { flex: 1; min-width: 0; }

.pf-fav-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}

.pf-fav-cat { font-size: 11px; color: var(--text-muted); }

.pf-fav-remove {
  background: none;
  color: var(--text-muted);
  font-size: 20px;
  padding: 0 4px;
}

.pf-add-fav-btn {
  width: 100%;
  padding: 10px;
  background: var(--bg-glass-light);
  color: var(--accent);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
}

/* Place picker */
.pf-picker {
  margin-top: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  overflow: hidden;
}

.pf-picker-search {
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  color: var(--text-primary);
  border: none;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.pf-picker-list { max-height: 200px; overflow-y: auto; }

.pf-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  text-align: left;

  &:active { background: var(--bg-hover); }
}

.pf-picker-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* ===== SETTINGS ===== */
.pf-settings-card {
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.pf-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;

  &.clickable {
    cursor: pointer;
    background: transparent;
    width: 100%;
    text-align: left;

    &:active { background: var(--bg-hover); }
  }
}

.pf-setting-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.pf-setting-divider {
  height: 1px;
  background: var(--border);
  margin: 0 16px;
}

.pf-toggle {
  position: relative;
  width: 48px;
  height: 26px;
  border-radius: 13px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  padding: 2px;
  transition: all 0.25s ease;

  &.on {
    background: var(--accent);
    border-color: var(--accent);

    .pf-toggle-knob { transform: translateX(22px); }
  }
}

.pf-toggle-knob {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s ease;
}

/* Password form */
.pf-pw-form { padding: 0 16px 16px; }

.pf-pw-save {
  width: 100%;
  padding: 12px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}

/* Import status */
.pf-import-status {
  margin-top: 8px;
  font-size: 12px;
  color: var(--accent);
  text-align: center;
  font-weight: 500;
}

/* ===== LOGOUT ===== */
.pf-logout-section { padding-bottom: 40px; }

.pf-logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: var(--radius-lg);
  font-size: 15px;
  font-weight: 600;

  &:active { background: rgba(239, 68, 68, 0.15); }
}
</style>
