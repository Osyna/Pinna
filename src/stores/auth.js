import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, setToken, setRefreshToken } from '../api.js'
import { useTheme } from '../composables/useTheme'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)
  const { setFromServer, setSaveCallback } = useTheme()

  const isAuthenticated = computed(() => !!user.value)

  function syncTheme(userData) {
    if (userData?.theme) setFromServer(userData.theme)
  }

  setSaveCallback((newTheme) => {
    if (user.value) {
      api.put('/auth/profile', { theme: newTheme }).catch(() => { })
    }
  })

  async function init() {
    const token = localStorage.getItem('pinna-token')
    if (!token) { loading.value = false; return }
    try {
      const data = await api.get('/auth/me')
      user.value = data.user
      syncTheme(data.user)
    } catch {
      setToken(null)
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password })
    setToken(data.token)
    setRefreshToken(data.refreshToken)
    user.value = data.user
    syncTheme(data.user)
  }

  async function register(email, password, name, handle) {
    const data = await api.post('/auth/register', { email, password, name, handle: handle || undefined })
    setToken(data.token)
    setRefreshToken(data.refreshToken)
    user.value = data.user
    syncTheme(data.user)
  }

  async function checkHandle(handle) {
    const data = await api.get(`/auth/handle/check?handle=${encodeURIComponent(handle)}`)
    return data.available
  }

  async function suggestHandles(name) {
    const data = await api.get(`/auth/handle/suggest?name=${encodeURIComponent(name || '')}`)
    return data.suggestions
  }

  async function updateProfile(updates) {
    const data = await api.put('/auth/profile', updates)
    user.value = data.user
    return data.user
  }

  const avatarTs = ref(Date.now())

  function getAvatarUrl(userId) {
    if (!userId) return null
    return `/api/auth/avatar/${userId}?t=${avatarTs.value}`
  }

  async function uploadAvatar(base64) {
    await api.post('/auth/avatar', { image: base64 })
    avatarTs.value = Date.now()
  }

  async function removeAvatar() {
    await api.delete('/auth/avatar')
    avatarTs.value = Date.now()
  }

  function logout() {
    setToken(null)
    setRefreshToken(null)
    user.value = null
  }

  window.addEventListener('auth:logout', () => { user.value = null })

  return { user, loading, isAuthenticated, avatarTs, init, login, register, updateProfile, logout, checkHandle, suggestHandles, getAvatarUrl, uploadAvatar, removeAvatar }
})
