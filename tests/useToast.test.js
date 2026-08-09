import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useToast, showToast, dismissToast } from '../src/composables/useToast.js'

describe('useToast', () => {
  beforeEach(() => {
    const { toasts } = useToast()
    toasts.value = []
    vi.useFakeTimers()
  })

  it('adds and auto-dismisses a toast', () => {
    const { toasts } = useToast()
    showToast('hello', { duration: 1000 })
    expect(toasts.value).toHaveLength(1)
    vi.advanceTimersByTime(1100)
    expect(toasts.value).toHaveLength(0)
  })

  it('keeps action toasts on screen longer and dismisses manually', () => {
    const { toasts } = useToast()
    const handler = vi.fn()
    showToast('deleted', { duration: 1000, action: { label: 'Undo', handler } })
    vi.advanceTimersByTime(2000)
    expect(toasts.value).toHaveLength(1) // action floor is 4500ms
    dismissToast(toasts.value[0].id)
    expect(toasts.value).toHaveLength(0)
  })
})
