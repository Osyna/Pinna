import { ref, watchEffect } from 'vue'

const theme = ref('dark')
let initialized = false
let saveToServer = null

function initTheme() {
  if (initialized) return
  initialized = true

  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    theme.value = stored
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    theme.value = 'light'
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
  const metaColor = theme.value === 'dark' ? '#0D0D12' : '#F8F8FC'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', metaColor)
}

function setFromServer(serverTheme) {
  if (serverTheme === 'light' || serverTheme === 'dark') {
    theme.value = serverTheme
    localStorage.setItem('theme', serverTheme)
  }
}

function setSaveCallback(fn) {
  saveToServer = fn
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
  if (saveToServer) saveToServer(theme.value)
}

watchEffect(() => {
  applyTheme()
})

export function useTheme() {
  return { theme, initTheme, toggleTheme, setFromServer, setSaveCallback }
}
