<script setup>
import { ref } from 'vue'
import { usePlacesStore } from '../stores/places'
import { iconPathFor } from '../categoryIcons'
import { hapticTap, hapticSelect } from '../composables/useHaptics'

/**
 * Shared "what do you know about this place" form — every field used
 * to both save a new place (AddPlaceModal) and edit an existing one
 * (PlaceDetail's edit mode). Used to be two hand-maintained copies
 * that had already drifted (different class names, one of them never
 * actually reached by the cartoon theme) — now there is exactly one.
 */
const props = defineProps({
  modelValue: { type: Object, required: true }, // { name, address, website, category, cuisine, rating, tags, notes }
  autofocusName: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const store = usePlacesStore()
const hoverRating = ref(0)
const tagInput = ref('')
const poppedStar = ref(0)

function set(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function pickCategory(id) {
  hapticSelect()
  set('category', id)
}

function setRating(val) {
  const next = props.modelValue.rating === val ? 0 : val
  set('rating', next)
  hapticTap()
  poppedStar.value = val
  setTimeout(() => { poppedStar.value = 0 }, 260)
}

function addTag() {
  const tag = tagInput.value.trim().toLowerCase()
  if (tag && !(props.modelValue.tags || []).includes(tag)) {
    set('tags', [...(props.modelValue.tags || []), tag])
    hapticTap()
  }
  tagInput.value = ''
}

function removeTag(tag) {
  set('tags', (props.modelValue.tags || []).filter(t => t !== tag))
}
</script>

<template>
  <div class="pff">
    <div class="pff-field">
      <label class="pff-label">Name</label>
      <input
        class="pff-input"
        :value="modelValue.name"
        :autofocus="autofocusName"
        type="text" placeholder="Place name"
        @input="set('name', $event.target.value)"
        @keyup.enter="$emit('submit')"
      />
    </div>

    <div class="pff-field">
      <label class="pff-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10Z"/><circle cx="12" cy="9" r="2.2"/></svg>
        Address
      </label>
      <input
        class="pff-input"
        :value="modelValue.address"
        type="text" placeholder="Address"
        @input="set('address', $event.target.value)"
      />
    </div>

    <div class="pff-field">
      <label class="pff-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 010 18 14 14 0 010-18Z"/></svg>
        Website
      </label>
      <input
        class="pff-input"
        :value="modelValue.website"
        type="url" placeholder="https://..."
        @input="set('website', $event.target.value)"
      />
    </div>

    <div class="pff-field">
      <label class="pff-label">Category</label>
      <div class="pff-cat-scroll">
        <button
          v-for="cat in store.categories" :key="cat.id" type="button"
          :class="['pff-cat-chip', { active: modelValue.category === cat.id }]"
          :style="modelValue.category === cat.id
            ? { background: cat.color, boxShadow: `0 4px 12px ${cat.color}55` }
            : { color: cat.color }"
          @click="pickCategory(cat.id)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path :d="iconPathFor(cat.icon)" />
          </svg>
          {{ cat.name }}
        </button>
      </div>
    </div>

    <div class="pff-field">
      <label class="pff-label">Cuisine</label>
      <div class="pff-select-wrap">
        <select
          class="pff-input pff-select"
          :value="modelValue.cuisine"
          @change="set('cuisine', $event.target.value)"
        >
          <option v-for="c in store.cuisineTypes" :key="c" :value="c">{{ c }}</option>
        </select>
        <svg class="pff-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>

    <div class="pff-field">
      <label class="pff-label">Rating</label>
      <div class="pff-stars">
        <button
          v-for="i in 5" :key="i" type="button"
          :class="['pff-star-btn', { popped: poppedStar === i }]"
          @click="setRating(i)"
          @mouseenter="hoverRating = i"
          @mouseleave="hoverRating = 0"
        >
          <svg width="27" height="27" viewBox="0 0 24 24"
            :fill="i <= (hoverRating || modelValue.rating || 0) ? '#ffc94a' : 'none'"
            :stroke="i <= (hoverRating || modelValue.rating || 0) ? '#e8a613' : 'currentColor'"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <span v-if="modelValue.rating" class="pff-rating-label">{{ modelValue.rating }}/5</span>
      </div>
    </div>

    <div class="pff-field">
      <label class="pff-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        Tags
      </label>
      <div class="pff-tag-wrap">
        <div v-if="modelValue.tags?.length" class="pff-tags-list">
          <span v-for="tag in modelValue.tags" :key="tag" class="pff-tag">
            {{ tag }}
            <button type="button" class="pff-tag-remove" @click="removeTag(tag)">&times;</button>
          </span>
        </div>
        <input
          class="pff-tag-input"
          v-model="tagInput"
          type="text" placeholder="Add tag and press Enter..."
          @keyup.enter="addTag"
        />
      </div>
    </div>

    <div class="pff-field">
      <label class="pff-label">Notes</label>
      <textarea
        class="pff-input pff-notes"
        :value="modelValue.notes"
        placeholder="Add notes..." rows="3"
        @input="set('notes', $event.target.value)"
      ></textarea>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pff {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pff-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.pff-input {
  width: 100%;
  padding: 13px 16px;
  font-size: 15px;
  font-family: inherit;
  box-sizing: border-box;
}

.pff-cat-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 4px;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.pff-cat-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;

  &:active { transform: scale(0.95); }

  &.active {
    color: #fff;
    transform: translateY(-1px);
  }
}

.pff-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.pff-select {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  padding-right: 38px;
}

.pff-select-chevron {
  position: absolute;
  right: 15px;
  pointer-events: none;
}

.pff-stars {
  display: flex;
  align-items: center;
  gap: 3px;
}

.pff-star-btn {
  background: none;
  padding: 3px;
  transition: transform 0.15s ease;

  &.popped { animation: pff-star-pop 0.26s cubic-bezier(0.3, 1.4, 0.4, 1); }
  &:active { transform: scale(0.85); }
}

@keyframes pff-star-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.25); }
  100% { transform: scale(1); }
}

.pff-rating-label {
  margin-left: 8px;
  font-size: 14px;
  font-weight: 800;
}

.pff-tag-wrap {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  border-radius: 16px;
}

.pff-tag-input {
  background: none;
  border: none;
  box-shadow: none;
  padding: 4px 2px;
  font-size: 14px;
}

.pff-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pff-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px 5px 12px;
  border-radius: 11px;
  font-size: 12.5px;
  font-weight: 700;
}

.pff-tag-remove {
  background: none;
  font-size: 15px;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.6;
  &:active { opacity: 1; }
}

.pff-notes {
  resize: vertical;
  min-height: 76px;
}
</style>
