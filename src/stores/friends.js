import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api.js'
import { showToast } from '../composables/useToast'
import { DEFAULT_CATEGORIES } from '../categoryIcons'
// ^ Was previously its own hand-maintained copy with a stale Tailwind-esque
// palette (#ef4444, #a855f7, #f97316...) left over from before the cartoon
// theme — a friend without custom categories would show "Restaurant" in a
// visibly different red than your own places. Now sourced from the same
// place as everything else so it can never drift again.

export const useFriendsStore = defineStore('friends', () => {
  const friends = ref([])
  const incomingRequests = ref([])
  const sentRequests = ref([])
  const viewingFriendId = ref(null)
  const viewingFriendPlaces = ref([])
  const viewingFriendCategories = ref([])
  const viewingFriendInfo = ref(null)

  const pendingCount = computed(() => incomingRequests.value.length)

  async function fetchFriends() {
    try {
      const data = await api.get('/friends')
      friends.value = data.friends
    } catch { /* silent */ }
  }

  async function fetchRequests() {
    try {
      const data = await api.get('/friends/requests')
      incomingRequests.value = data.requests
    } catch { /* silent */ }
  }

  async function fetchSentRequests() {
    try {
      const data = await api.get('/friends/sent')
      sentRequests.value = data.requests
    } catch { /* silent */ }
  }

  async function sendRequest(handle) {
    const data = await api.post('/friends/request', { handle })
    showToast('Friend request sent!', { type: 'success' })
    await fetchSentRequests()
    return data.friendship
  }

  async function acceptRequest(id) {
    await api.put(`/friends/requests/${id}/accept`)
    showToast('Friend request accepted!', { type: 'success' })
    await Promise.all([fetchFriends(), fetchRequests()])
  }

  async function rejectRequest(id) {
    await api.put(`/friends/requests/${id}/reject`)
    showToast('Request declined')
    await fetchRequests()
  }

  async function removeFriend(id) {
    await api.delete(`/friends/${id}`)
    friends.value = friends.value.filter(f => f.id !== id)
    if (viewingFriendId.value === id) clearFriendView()
    showToast('Friend removed')
  }

  async function viewFriendPlaces(friendId) {
    const friend = friends.value.find(f => f.id === friendId)
    viewingFriendInfo.value = friend || null
    viewingFriendId.value = friendId
    const [placesData, catsData] = await Promise.all([
      api.get(`/friends/${friendId}/places`),
      api.get(`/friends/${friendId}/categories`),
    ])
    viewingFriendPlaces.value = placesData.places
    viewingFriendCategories.value = catsData.categories?.length ? catsData.categories : [...DEFAULT_CATEGORIES]
  }

  function clearFriendView() {
    viewingFriendId.value = null
    viewingFriendPlaces.value = []
    viewingFriendCategories.value = []
    viewingFriendInfo.value = null
  }

  function getCategoryById(id) {
    return viewingFriendCategories.value.find(c => c.id === id)
      || viewingFriendCategories.value[viewingFriendCategories.value.length - 1]
      || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]
  }

  function reset() {
    friends.value = []
    incomingRequests.value = []
    sentRequests.value = []
    clearFriendView()
  }

  return {
    friends,
    incomingRequests,
    sentRequests,
    viewingFriendId,
    viewingFriendPlaces,
    viewingFriendCategories,
    viewingFriendInfo,
    pendingCount,
    fetchFriends,
    fetchRequests,
    fetchSentRequests,
    sendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    viewFriendPlaces,
    clearFriendView,
    getCategoryById,
    reset,
  }
})
