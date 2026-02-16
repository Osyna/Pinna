import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

/**
 * Show a toast notification.
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info', duration?: number }} [opts]
 */
export function showToast(message, { type = 'success', duration = 2500 } = {}) {
  const id = ++nextId
  toasts.value.push({ id, message, type })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, duration)
}

export function useToast() {
  return { toasts, showToast }
}
