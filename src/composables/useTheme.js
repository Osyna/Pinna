import { ref, watchEffect } from 'vue'

const theme = ref('dark')
const skin = ref('classic') // 'classic' | 'cartoon'
let initialized = false
let saveToServer = null
let saveSkinToServer = null

function initTheme() {
  if (initialized) return
  initialized = true

  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    theme.value = stored
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    theme.value = 'light'
  }

  const storedSkin = localStorage.getItem('skin')
  if (storedSkin === 'classic' || storedSkin === 'cartoon') {
    skin.value = storedSkin
  }

  applyTheme()

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      theme.value = e.matches ? 'dark' : 'light'
    }
  })
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme.value)
  document.documentElement.setAttribute('data-skin', skin.value)
  const metaColor = skin.value === 'cartoon'
    ? '#fff8ec'
    : theme.value === 'dark' ? '#0D0D12' : '#F8F8FC'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', metaColor)
}

function setFromServer(serverTheme) {
  if (serverTheme === 'light' || serverTheme === 'dark') {
    theme.value = serverTheme
    localStorage.setItem('theme', serverTheme)
  }
}

function setSkinFromServer(serverSkin) {
  if (serverSkin === 'classic' || serverSkin === 'cartoon') {
    skin.value = serverSkin
    localStorage.setItem('skin', serverSkin)
  }
}

function setSaveCallback(fn) {
  saveToServer = fn
}

function setSkinSaveCallback(fn) {
  saveSkinToServer = fn
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
  if (saveToServer) saveToServer(theme.value)
}

function toggleSkin() {
  skin.value = skin.value === 'cartoon' ? 'classic' : 'cartoon'
  localStorage.setItem('skin', skin.value)
  // Cartoon mode is a light, papery look — switch the base theme to light so
  // map tiles and any non-skinned surfaces match the cream UI.
  if (skin.value === 'cartoon' && theme.value === 'dark') {
    theme.value = 'light'
    localStorage.setItem('theme', 'light')
    if (saveToServer) saveToServer('light')
  }
  if (saveSkinToServer) saveSkinToServer(skin.value)
}

watchEffect(() => {
  applyTheme()
})

export function useTheme() {
  return {
    theme, skin, initTheme, toggleTheme, toggleSkin,
    setFromServer, setSkinFromServer, setSaveCallback, setSkinSaveCallback,
  }
}
