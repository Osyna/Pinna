import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

/**
 * Show a toast notification.
 * @param {string} message
 * @param {{ type?: 'success'|'error'|'info', duration?: number,
 *           action?: { label: string, handler: () => void } }} [opts]
 */
export function showToast(message, { type = 'success', duration = 2500, action = null } = {}) {
  const id = ++nextId
  toasts.value.push({ id, message, type, action })
  setTimeout(() => {
    dismissToast(id)
  }, action ? Math.max(duration, 4500) : duration)
}

export function dismissToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

export function useToast() {
  return { toasts, showToast, dismissToast }
}
