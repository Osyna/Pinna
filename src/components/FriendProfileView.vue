<script setup>
import { computed, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useFriendsStore } from '../stores/friends'
import { showToast } from '../composables/useToast'

const props = defineProps({
  friend: { type: Object, required: true },
})

const emit = defineEmits(['back', 'view-map', 'removed'])

const authStore = useAuthStore()
const friendsStore = useFriendsStore()
const avatarError = reactive({})

const avatarUrl = computed(() => authStore.getAvatarUrl(props.friend.id))
const initial = computed(() => (props.friend.name || '?').charAt(0).toUpperCase())

async function removeFriend() {
  try {
    await friendsStore.removeFriend(props.friend.id)
    emit('removed')
  } catch {
    showToast('Failed to remove friend', { type: 'error' })
  }
}
</script>

<template>
  <div class="fp-view">
    <div class="fp-scroll">

      <!-- Header bar -->
      <div class="fp-header">
        <button class="fp-back" @click="$emit('back')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span class="fp-header-title">Profile</span>
        <div class="fp-header-spacer"></div>
      </div>

      <!-- Hero -->
      <div class="fp-hero">
        <div class="fp-avatar">
          <img
            v-if="!avatarError[friend.id]"
            :src="avatarUrl"
            class="fp-avatar-img"
            @error="avatarError[friend.id] = true"
          />
          <span v-else class="fp-avatar-fallback">{{ initial }}</span>
        </div>

        <h1 class="fp-name">{{ friend.name || 'User' }}</h1>
        <span class="fp-handle">#{{ friend.handle }}</span>
        <p v-if="friend.bio" class="fp-bio">{{ friend.bio }}</p>
      </div>

      <!-- Stats -->
      <div class="fp-stats">
        <div class="fp-stat">
          <span class="fp-stat-num">{{ friend.placeCount }}</span>
          <span class="fp-stat-label">Places</span>
        </div>
        <div class="fp-stat-divider"></div>
        <div class="fp-stat">
          <span class="fp-stat-num">{{ friend.country || '---' }}</span>
          <span class="fp-stat-label">Country</span>
        </div>
      </div>

      <!-- View Map CTA -->
      <div class="fp-section">
        <button class="fp-map-btn" @click="$emit('view-map', friend.id)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          <div class="fp-map-btn-text">
            <span class="fp-map-btn-title">View {{ friend.name?.split(' ')[0] || 'Their' }}'s Map</span>
            <span class="fp-map-btn-sub">{{ friend.placeCount }} saved places</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

      <!-- Favorite Cuisines -->
      <div v-if="friend.favoriteCuisines?.length" class="fp-section">
        <h3 class="fp-section-title">Favorite Cuisines</h3>
        <div class="fp-chips">
          <span v-for="c in friend.favoriteCuisines" :key="c" class="fp-chip">{{ c }}</span>
        </div>
      </div>

      <!-- Remove friend -->
      <div class="fp-section fp-danger-section">
        <button class="fp-remove-btn" @click="removeFriend">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Remove Friend
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fp-view {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
}

.fp-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Header */
.fp-header {
  display: flex;
  align-items: center;
  padding: 12px 16px 8px;
  gap: 12px;
  flex-shrink: 0;
}

.fp-back {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: 50%;
  color: var(--text-primary);

  &:active { transform: scale(0.92); }
}

.fp-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.fp-header-spacer { width: 36px; }

/* Hero */
.fp-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 20px 20px;
}

.fp-avatar {
  @include avatar-gradient;
  width: 96px;
  height: 96px;
  overflow: hidden;
  border: 3px solid var(--border);
  margin-bottom: 12px;
}

.fp-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fp-avatar-fallback {
  color: white;
  font-size: 36px;
  font-weight: 700;
}

.fp-name {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.fp-handle {
  margin-top: 4px;
  padding: 3px 14px;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 16px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid rgba($accent, 0.15);
}

.fp-bio {
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
  max-width: 320px;
}

/* Stats */
.fp-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px 24px;
}

.fp-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.fp-stat-num {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.fp-stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fp-stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border);
}

/* Sections */
.fp-section { padding: 0 20px 20px; }

.fp-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

/* Map CTA */
.fp-map-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px;
  background: var(--accent-light);
  border: 1px solid rgba($accent, 0.2);
  border-radius: var(--radius-lg);
  text-align: left;
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.98);
    background: var(--accent);

    * { color: white !important; stroke: white !important; }
  }

  svg:first-child { color: var(--accent); flex-shrink: 0; }
  svg:last-child { color: var(--text-muted); flex-shrink: 0; }
}

.fp-map-btn-text { flex: 1; min-width: 0; }

.fp-map-btn-title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
}

.fp-map-btn-sub {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Chips */
.fp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.fp-chip {
  padding: 6px 14px;
  font-size: 13px;
  border-radius: 20px;
  background: var(--accent-light);
  color: var(--accent);
  border: 1px solid rgba($accent, 0.15);
  font-weight: 600;
}

/* Remove friend */
.fp-danger-section { padding-bottom: 40px; }

.fp-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  background: rgba(239, 68, 68, 0.06);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.12);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;

  &:active { background: rgba(239, 68, 68, 0.15); }
}
</style>
