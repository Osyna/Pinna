import { ref, watch, isRef } from 'vue'

const sessionCache = new Map()

export function useLinkPreview(url) {
  const imageUrl = ref(null)
  const loading = ref(false)

  async function fetchPreview(rawUrl) {
    if (!rawUrl) {
      imageUrl.value = null
      return
    }

    // Session cache hit
    if (sessionCache.has(rawUrl)) {
      imageUrl.value = sessionCache.get(rawUrl)
      return
    }

    loading.value = true
    try {
      const res = await fetch(`/api/preview?url=${encodeURIComponent(rawUrl)}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const img = data.image || null
      sessionCache.set(rawUrl, img)
      imageUrl.value = img
    } catch {
      sessionCache.set(rawUrl, null)
      imageUrl.value = null
    } finally {
      loading.value = false
    }
  }

  if (isRef(url)) {
    watch(url, (val) => fetchPreview(val), { immediate: true })
  } else {
    fetchPreview(url)
  }

  return { imageUrl, loading }
}
