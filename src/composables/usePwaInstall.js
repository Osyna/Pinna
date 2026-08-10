import { ref, computed } from 'vue'

/**
 * PWA "Add to Home Screen" install helper.
 *
 * Singleton state (module-level refs) so both the auto-shown first-launch
 * card and the on-demand Profile button control the exact same sheet.
 *
 * - Android/desktop Chrome/Edge: captures the real `beforeinstallprompt`
 *   event and can trigger the browser's native install dialog directly.
 * - iOS Safari has no such API (Apple doesn't expose one) — there, we show
 *   the manual "Share -> Add to Home Screen" steps instead.
 */

const LS_DISMISSED_KEY = 'pinna-pwa-prompt-dismissed'

function detectPlatform() {
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS 13+ reports as Mac
  if (isIOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function detectStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

const show = ref(false)
const platform = ref(detectPlatform())
const isStandalone = ref(detectStandalone())
const deferredPrompt = ref(null)

const canNativeInstall = computed(() => !!deferredPrompt.value)

let listenersBound = false
function bindListeners() {
  if (listenersBound) return
  listenersBound = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
  })

  window.addEventListener('appinstalled', () => {
    isStandalone.value = true
    deferredPrompt.value = null
  })

  window.matchMedia?.('(display-mode: standalone)')
    .addEventListener?.('change', (e) => { isStandalone.value = e.matches })
}

function open() {
  show.value = true
}

function close() {
  show.value = false
}

/** Close + remember, so the automatic first-launch card doesn't nag again. */
function dismiss() {
  try { localStorage.setItem(LS_DISMISSED_KEY, '1') } catch { /* storage blocked */ }
  show.value = false
}

/** Call once, shortly after the splash screen finishes. */
function maybeAutoShow() {
  if (isStandalone.value) return
  if (platform.value !== 'ios' && platform.value !== 'android') return
  let dismissed = false
  try { dismissed = localStorage.getItem(LS_DISMISSED_KEY) === '1' } catch { /* storage blocked */ }
  if (dismissed) return
  show.value = true
}

/** Trigger the real browser install dialog (Android / desktop Chrome+Edge). */
async function promptNativeInstall() {
  if (!deferredPrompt.value) return null
  deferredPrompt.value.prompt()
  const choice = await deferredPrompt.value.userChoice
  deferredPrompt.value = null
  return choice.outcome // 'accepted' | 'dismissed'
}

export function usePwaInstall() {
  bindListeners()
  return {
    show, platform, isStandalone, canNativeInstall,
    open, close, dismiss, maybeAutoShow, promptNativeInstall,
  }
}
