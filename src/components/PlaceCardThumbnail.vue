<script setup>
import { computed } from 'vue'
import { useLinkPreview } from '../composables/useLinkPreview'

const props = defineProps({
  website: { type: String, default: '' },
})

const url = computed(() => props.website || '')
const { imageUrl, loading } = useLinkPreview(url)
</script>

<template>
  <div v-if="loading" class="card-thumb skeleton"></div>
  <img v-else-if="imageUrl" :src="imageUrl" class="card-thumb" alt="" />
</template>

<style scoped lang="scss">
.card-thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;

  &.skeleton {
    background: linear-gradient(90deg, var(--bg-glass-light) 25%, var(--bg-hover) 50%, var(--bg-glass-light) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
