import { ref } from 'vue'

// Pinna's cartoon-game look is the app's one and only theme.
// The base palette is light (cream paper), which also drives the
// default map tile style in MapView.
const theme = ref('light')
let initialized = false

function initTheme() {
  if (initialized) return
  initialized = true
  applyTheme()
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', 'light')
  document.documentElement.setAttribute('data-skin', 'cartoon')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fff8ec')
}

export function useTheme() {
  return { theme, initTheme }
}
