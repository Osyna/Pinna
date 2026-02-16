import { watch, shallowRef } from 'vue'
import Fuse from 'fuse.js'

/** @type {string[]} Fields to search for substring matches */
const SEARCH_FIELDS = ['name', 'cuisine', 'address', 'notes']

/**
 * Hybrid fuzzy + substring search composable.
 * Phase 1: substring/prefix match (catches "sush" in "sushi", "burg" in "burger")
 * Phase 2: Fuse.js approximate match (catches typos like "resturant" → "restaurant")
 * Results merged with exact/substring matches ranked higher.
 *
 * @param {import('vue').Ref<Array>} items - reactive array to search
 * @param {Object} [options] - Fuse.js options override
 */
export function useFuseSearch(items, options = {}) {
  const fuse = shallowRef(null)

  const defaultOptions = {
    keys: [
      { name: 'name', weight: 1.0 },
      { name: 'cuisine', weight: 0.8 },
      { name: 'tags', weight: 0.6 },
      { name: 'address', weight: 0.4 },
    ],
    threshold: 0.45,
    distance: 300,
    minMatchCharLength: 2,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true,
    ...options,
  }

  function buildIndex() {
    fuse.value = new Fuse(items.value || [], defaultOptions)
  }

  watch(items, buildIndex, { immediate: true, deep: false })

  /**
   * Substring match: splits query into tokens, matches each independently.
   * A place matches if ANY token hits any field. Score improves with more tokens matched.
   * @param {string} q - lowercased query
   * @returns {Array<{item: Object, substringScore: number}>}
   */
  function substringMatch(q) {
    const tokens = q.split(/\s+/).filter(t => t.length >= 2)
    if (tokens.length === 0) return []

    const list = items.value || []
    const matched = []

    for (const item of list) {
      // Build a single searchable blob per item
      const fieldTexts = SEARCH_FIELDS.map(f => {
        const v = item[f]
        return (v && typeof v === 'string') ? v.toLowerCase() : ''
      })
      const tagsText = Array.isArray(item.tags) ? item.tags.map(t => typeof t === 'string' ? t.toLowerCase() : '').join(' ') : ''

      let tokensHit = 0
      let bestScore = Infinity

      for (const token of tokens) {
        let tokenMatched = false

        for (let fi = 0; fi < SEARCH_FIELDS.length; fi++) {
          const lower = fieldTexts[fi]
          if (!lower) continue
          const idx = lower.indexOf(token)
          if (idx === -1) continue
          tokenMatched = true
          const posScore = idx === 0 ? 0 : 0.1 + (idx / lower.length) * 0.1
          const fieldBoost = SEARCH_FIELDS[fi] === 'name' ? 0 : 0.05
          bestScore = Math.min(bestScore, posScore + fieldBoost)
        }

        if (!tokenMatched && tagsText.includes(token)) {
          tokenMatched = true
          bestScore = Math.min(bestScore, 0.15)
        }

        if (tokenMatched) tokensHit++
      }

      if (tokensHit === 0) continue

      // Penalize partial token coverage: fewer tokens matched = higher (worse) score
      const coverage = tokensHit / tokens.length
      const coveragePenalty = (1 - coverage) * 0.4
      matched.push({ item, substringScore: bestScore + coveragePenalty })
    }

    return matched
  }

  /**
   * Hybrid search: substring matches first, then fuzzy, merged and deduped.
   * @param {string} query
   * @param {number} [limit=8]
   * @returns {Array} matched items sorted by relevance
   */
  function search(query, limit = 8) {
    if (!query || query.trim().length < 2) return []

    const q = query.trim().toLowerCase()
    const tokens = q.split(/\s+/).filter(t => t.length >= 2)

    // Phase 1: fast substring/prefix matches (tokenized)
    const subMatches = substringMatch(q)

    // Phase 2: Fuse.js fuzzy matches — search each token and intersect/union results
    let fuseMatches = []
    if (fuse.value) {
      if (tokens.length <= 1) {
        fuseMatches = fuse.value.search(q, { limit: limit * 2 })
      } else {
        // Search each token separately with tighter threshold, require multiple hits
        /** @type {Map<string, {item: Object, totalScore: number, hits: number}>} */
        const perItem = new Map()
        for (const token of tokens) {
          // Use tighter threshold per token to avoid loose matches like "brasserie"→"brussels"
          const results = fuse.value.search(token, { limit: limit * 3 })
          for (const r of results) {
            // Skip very loose matches (score > 0.35 means poor quality)
            if ((r.score || 0) > 0.35) continue
            const id = r.item.id
            const existing = perItem.get(id)
            if (existing) {
              existing.totalScore += (r.score || 0)
              existing.hits++
            } else {
              perItem.set(id, { item: r.item, totalScore: r.score || 0, hits: 1 })
            }
          }
        }
        // Convert to fuse-like results, heavily penalize if not all tokens matched
        fuseMatches = [...perItem.values()].map(e => ({
          item: e.item,
          score: (e.totalScore / e.hits) + (1 - e.hits / tokens.length) * 0.5,
        }))
        fuseMatches.sort((a, b) => a.score - b.score)
        fuseMatches = fuseMatches.slice(0, limit * 2)
      }
    }

    // Merge: substring matches get priority (lower score = better)
    const seen = new Set()
    /** @type {Array<{item: Object, score: number}>} */
    const merged = []

    for (const m of subMatches) {
      const id = m.item.id
      if (seen.has(id)) continue
      seen.add(id)
      merged.push({ item: m.item, score: m.substringScore })
    }

    for (const m of fuseMatches) {
      const id = m.item.id
      if (seen.has(id)) continue
      seen.add(id)
      // Fuse scores are 0-1 (0 = perfect). Offset by 0.3 so substring matches rank above.
      merged.push({ item: m.item, score: 0.3 + (m.score || 0) })
    }

    merged.sort((a, b) => a.score - b.score)
    return merged.slice(0, limit).map(m => m.item)
  }

  return { search, buildIndex }
}
