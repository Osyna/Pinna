import { ref } from 'vue'

const STORAGE_KEY = 'mappsly_recent_searches'
const MAX_ITEMS = 8

const recents = ref(load())

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.value))
}

export function useRecentSearches() {
  function add(query) {
    const q = query.trim()
    if (!q || q.length < 2) return
    recents.value = [q, ...recents.value.filter(r => r !== q)].slice(0, MAX_ITEMS)
    save()
  }

  function remove(query) {
    recents.value = recents.value.filter(r => r !== query)
    save()
  }

  function clear() {
    recents.value = []
    save()
  }

  return { recents, add, remove, clear }
}
