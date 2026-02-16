<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useFriendsStore } from '../stores/friends'
import { useAuthStore } from '../stores/auth'
import { hapticTap } from '../composables/useHaptics'
import { showToast } from '../composables/useToast'
import FriendProfileView from './FriendProfileView.vue'

const emit = defineEmits(['view-friend-map'])
const friendsStore = useFriendsStore()
const authStore = useAuthStore()
const avatarErrors = reactive({})

const activeSection = ref('friends') // 'friends' | 'requests'
const selectedFriend = ref(null)
const handleInput = ref('')
const sending = ref(false)
const sendError = ref('')

onMounted(async () => {
  await Promise.all([
    friendsStore.fetchFriends(),
    friendsStore.fetchRequests(),
    friendsStore.fetchSentRequests(),
  ])
})

async function sendRequest() {
  const raw = handleInput.value.trim().replace(/^#/, '')
  if (!raw) return
  sendError.value = ''
  sending.value = true
  try {
    await friendsStore.sendRequest(raw)
    handleInput.value = ''
  } catch (err) {
    sendError.value = err.message
  } finally {
    sending.value = false
  }
}

async function acceptRequest(id) {
  hapticTap()
  await friendsStore.acceptRequest(id)
}

async function rejectRequest(id) {
  hapticTap()
  await friendsStore.rejectRequest(id)
}

function viewFriend(friend) {
  hapticTap()
  selectedFriend.value = friend
}

function onViewMap(friendId) {
  selectedFriend.value = null
  emit('view-friend-map', friendId)
}

function onFriendRemoved() {
  selectedFriend.value = null
}

function getInitial(name) {
  return (name || '?').charAt(0).toUpperCase()
}
</script>

<template>
  <div class="friends-view">
    <!-- Header -->
    <div class="fv-header">
      <h1 class="fv-title">Friends</h1>
      <span class="fv-count">{{ friendsStore.friends.length }}</span>
    </div>

    <!-- Add friend search -->
    <div class="fv-add-wrap">
      <div class="fv-add-input-wrap">
        <span class="fv-add-prefix">#</span>
        <input
          v-model="handleInput"
          type="text"
          placeholder="Add by user ID..."
          class="fv-add-input"
          autocomplete="off"
          @keyup.enter="sendRequest"
        />
        <button
          class="fv-add-btn"
          :disabled="!handleInput.trim() || sending"
          @click="sendRequest"
        >
          {{ sending ? '...' : 'Add' }}
        </button>
      </div>
      <p v-if="sendError" class="fv-add-error">{{ sendError }}</p>
    </div>

    <!-- Section tabs -->
    <div class="fv-tabs">
      <button
        :class="['fv-tab', { active: activeSection === 'friends' }]"
        @click="activeSection = 'friends'"
      >
        Friends
      </button>
      <button
        :class="['fv-tab', { active: activeSection === 'requests' }]"
        @click="activeSection = 'requests'"
      >
        Requests
        <span v-if="friendsStore.pendingCount > 0" class="fv-badge">{{ friendsStore.pendingCount }}</span>
      </button>
    </div>

    <!-- Friends list -->
    <div class="fv-list">
      <template v-if="activeSection === 'friends'">
        <div v-if="friendsStore.friends.length === 0" class="fv-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <p>No friends yet</p>
          <span class="fv-empty-hint">Add friends by their #user_id</span>
        </div>

        <button
          v-for="friend in friendsStore.friends" :key="friend.id"
          class="fv-friend-card"
          @click="viewFriend(friend)"
        >
          <div class="fv-avatar">
            <img
              v-if="!avatarErrors[friend.id]"
              :src="authStore.getAvatarUrl(friend.id)"
              class="fv-avatar-img"
              @error="avatarErrors[friend.id] = true"
            />
            <span v-else>{{ getInitial(friend.name) }}</span>
          </div>
          <div class="fv-friend-info">
            <span class="fv-friend-name">{{ friend.name || 'User' }}</span>
            <span class="fv-friend-handle">#{{ friend.handle }}</span>
          </div>
          <span class="fv-friend-places">{{ friend.placeCount }} places</span>
          <svg class="fv-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </template>

      <template v-if="activeSection === 'requests'">
        <!-- Incoming requests -->
        <div v-if="friendsStore.incomingRequests.length" class="fv-section-label">Incoming</div>
        <div
          v-for="req in friendsStore.incomingRequests" :key="req.id"
          class="fv-request-card"
        >
          <div class="fv-avatar small">
            <img
              v-if="!avatarErrors[req.sender.id]"
              :src="authStore.getAvatarUrl(req.sender.id)"
              class="fv-avatar-img"
              @error="avatarErrors[req.sender.id] = true"
            />
            <span v-else>{{ getInitial(req.sender.name) }}</span>
          </div>
          <div class="fv-friend-info">
            <span class="fv-friend-name">{{ req.sender.name || 'User' }}</span>
            <span class="fv-friend-handle">#{{ req.sender.handle }}</span>
          </div>
          <div class="fv-request-actions">
            <button class="fv-accept-btn" @click="acceptRequest(req.id)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button class="fv-reject-btn" @click="rejectRequest(req.id)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Sent requests -->
        <div v-if="friendsStore.sentRequests.length" class="fv-section-label">Sent</div>
        <div
          v-for="req in friendsStore.sentRequests" :key="req.id"
          class="fv-request-card"
        >
          <div class="fv-avatar small">
            <img
              v-if="!avatarErrors[req.receiver.id]"
              :src="authStore.getAvatarUrl(req.receiver.id)"
              class="fv-avatar-img"
              @error="avatarErrors[req.receiver.id] = true"
            />
            <span v-else>{{ getInitial(req.receiver.name) }}</span>
          </div>
          <div class="fv-friend-info">
            <span class="fv-friend-name">{{ req.receiver.name || 'User' }}</span>
            <span class="fv-friend-handle">#{{ req.receiver.handle }}</span>
          </div>
          <span class="fv-pending-label">Pending</span>
        </div>

        <!-- Empty state for requests -->
        <div v-if="!friendsStore.incomingRequests.length && !friendsStore.sentRequests.length" class="fv-empty">
          <p>No pending requests</p>
        </div>
      </template>
    </div>

    <!-- Friend profile overlay -->
    <transition name="fv-slide">
      <FriendProfileView
        v-if="selectedFriend"
        :friend="selectedFriend"
        @back="selectedFriend = null"
        @view-map="onViewMap"
        @removed="onFriendRemoved"
      />
    </transition>
  </div>
</template>

<style scoped lang="scss">
.friends-view {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding-top: var(--safe-top);
  padding-bottom: calc(60px + var(--safe-bottom));
}

.fv-header {
  padding: 16px 20px 8px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-shrink: 0;
}

.fv-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, $accent, $accent-hover);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
}

.fv-count {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
}

/* Add friend */
.fv-add-wrap {
  padding: 8px 16px 0;
  flex-shrink: 0;
}

.fv-add-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border-radius: 14px;
  border: 1px solid var(--border);
  overflow: hidden;

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-light);
  }
}

.fv-add-prefix {
  padding: 0 0 0 14px;
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 600;
}

.fv-add-input {
  flex: 1;
  background: none;
  border: none;
  padding: 12px 8px;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  min-width: 0;

  &::placeholder { color: var(--text-muted); }
}

.fv-add-btn {
  padding: 8px 18px;
  margin: 4px;
  background: var(--accent);
  color: white;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;

  &:disabled { opacity: 0.4; }
}

.fv-add-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--danger);
  padding-left: 4px;
}

/* Tabs */
.fv-tabs {
  display: flex;
  gap: 2px;
  padding: 12px 16px 0;
  flex-shrink: 0;
}

.fv-tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all var(--transition);

  &.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
}

.fv-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--danger);
  color: white;
  font-size: 10px;
  font-weight: 700;
  border-radius: 9px;
}

/* List */
.fv-list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 12px;
}

.fv-section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 8px 6px;
}

/* Friend card */
.fv-friend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  margin-bottom: 6px;
  background: var(--bg-glass);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-align: left;
  transition: all 150ms ease;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: var(--shadow), inset 0 1px 0 var(--glass-highlight);

  &:active {
    background: var(--bg-hover);
    transform: scale(0.98);
  }
}

.fv-avatar {
  @include avatar-gradient;
  width: 42px;
  height: 42px;
  font-size: 18px;
  flex-shrink: 0;
  overflow: hidden;

  &.small {
    width: 36px;
    height: 36px;
    font-size: 15px;
  }
}

.fv-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fv-friend-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fv-friend-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fv-friend-handle {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.fv-friend-places {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-light);
  padding: 3px 10px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.fv-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.5;
}

/* Request card */
.fv-request-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 6px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.fv-request-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.fv-accept-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border-radius: 50%;
  border: 1px solid rgba(34, 197, 94, 0.2);

  &:active { transform: scale(0.9); }
}

.fv-reject-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
  border-radius: 50%;
  border: 1px solid rgba(239, 68, 68, 0.15);

  &:active { transform: scale(0.9); }
}

.fv-pending-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  flex-shrink: 0;
}

/* Empty state */
.fv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  gap: 8px;
}

.fv-empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.6;
}

/* Slide transition for friend profile */
.fv-slide-enter-active { transition: transform 0.25s ease-out; }
.fv-slide-leave-active { transition: transform 0.2s ease-in; }
.fv-slide-enter-from { transform: translateX(100%); }
.fv-slide-leave-to { transform: translateX(100%); }
</style>
