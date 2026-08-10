<script setup>
import { iconPathFor } from '../categoryIcons'

/**
 * A category/type icon inside a small tinted circular bubble — the
 * shared "what kind of place is this" indicator used anywhere a place
 * or search result needs one inline (list rows, search results, small
 * badges). Icon + color always travel together (color is never the
 * only signal — accessibility), matching the same rule the map's
 * canvas-drawn markers follow.
 *
 * Not used for the "chip with a text label" controls (filter chips,
 * legend toggles) — those compose their own layout/active-state around
 * a bare stroked icon; this component is specifically the passive,
 * tinted "badge" look.
 */
defineProps({
  icon: { type: String, default: 'pin' },
  color: { type: String, default: '#8E8E93' },
  size: { type: Number, default: 26 },       // outer bubble diameter, px
  iconSize: { type: Number, default: 14 },    // glyph size, px
  tinted: { type: Boolean, default: true },   // false = transparent bg, icon color only
  radius: { type: String, default: '50%' },  // '50%' = circle (default); some rows use a rounded square
})
</script>

<template>
  <span
    class="cat-icon-bubble"
    :style="{
      width: size + 'px',
      height: size + 'px',
      background: tinted ? color + '22' : 'transparent',
      color,
      borderRadius: radius,
    }"
  >
    <svg :width="iconSize" :height="iconSize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path :d="iconPathFor(icon)" />
    </svg>
  </span>
</template>

<style scoped>
.cat-icon-bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
