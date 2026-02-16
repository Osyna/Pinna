<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { usePlacesStore } from '../stores/places'
import { hapticTap, hapticSuccess } from '../composables/useHaptics'
import { showToast } from '../composables/useToast'

const props = defineProps({
  lat: Number,
  lng: Number,
  initialAddress: { type: String, default: '' },
  initialName: { type: String, default: '' },
  initialCategory: { type: String, default: '' },
  initialCuisine: { type: String, default: '' },
  initialTags: { type: Array, default: () => [] },
  initialWebsite: { type: String, default: '' },
})

const emit = defineEmits(['close'])
const store = usePlacesStore()

const name = ref(props.initialName || (props.initialAddress ? props.initialAddress.split(',')[0] : ''))
const address = ref(props.initialAddress)
const category = ref(props.initialCategory || 'other')
const notes = ref('')
const rating = ref(0)
const cuisine = ref(props.initialCuisine || 'None')
const website = ref(props.initialWebsite || '')
const tags = ref([...(props.initialTags || [])])
const tagInput = ref('')
const hoverRating = ref(0)
const modalBodyRef = ref(null)
const dragY = ref(0)
const dragging = ref(false)
const startY = ref(0)

function addTag() {
  const tag = tagInput.value.trim().toLowerCase()
  if (tag && !tags.value.includes(tag)) {
    tags.value.push(tag)
    hapticTap()
  }
  tagInput.value = ''
}

function removeTag(tag) {
  tags.value = tags.value.filter(t => t !== tag)
}

function setRating(val) {
  rating.value = rating.value === val ? 0 : val
  hapticTap()
}

function save() {
  if (!name.value.trim()) return
  store.addPlace({
    name: name.value.trim(),
    lat: props.lat,
    lng: props.lng,
    address: address.value,
    category: category.value,
    notes: notes.value.trim(),
    rating: rating.value,
    cuisine: cuisine.value,
    tags: tags.value,
    website: website.value.trim(),
  })
  hapticSuccess()
  showToast('Place saved!', { type: 'success' })
  emit('close')
}

function onDragStart(e) {
  startY.value = e.touches[0].clientY
  dragging.value = true
}

function onDragMove(e) {
  if (!dragging.value) return
  const dy = e.touches[0].clientY - startY.value
  dragY.value = Math.max(0, dy)
}

function onDragEnd() {
  if (dragY.value > 100) {
    emit('close')
  }
  dragY.value = 0
  dragging.value = false
}

onMounted(() => {
  const body = modalBodyRef.value
  if (!body) return
  body.addEventListener('focusin', (e) => {
    const el = e.target
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  })
})
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" :style="dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : 'transform 0.3s ease' } : {}">
      <!-- Handle for mobile feel -->
      <div class="modal-handle" @touchstart="onDragStart" @touchmove.passive="onDragMove" @touchend="onDragEnd">
        <div class="handle-bar"></div>
      </div>

      <div class="modal-header">
        <h3>Save Place</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body" ref="modalBodyRef">
        <div class="field">
          <label>Name</label>
          <input v-model="name" type="text" placeholder="Place name" autofocus @keyup.enter="save" />
        </div>

        <div class="field">
          <label>Address</label>
          <input v-model="address" type="text" placeholder="Address" />
        </div>

        <div class="field">
          <label>Website</label>
          <input v-model="website" type="url" placeholder="https://..." />
        </div>

        <div class="row-2">
          <div class="field">
            <label>Category</label>
            <select v-model="category">
              <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="field">
            <label>Cuisine</label>
            <select v-model="cuisine">
              <option v-for="c in store.cuisineTypes" :key="c" :value="c">
                {{ c }}
              </option>
            </select>
          </div>
        </div>

        <div class="field">
          <label>Rating</label>
          <div class="star-rating">
            <button
              v-for="i in 5"
              :key="i"
              class="star-btn"
              @click="setRating(i)"
              @mouseenter="hoverRating = i"
              @mouseleave="hoverRating = 0"
            >
              <svg width="28" height="28" viewBox="0 0 24 24"
                :fill="i <= (hoverRating || rating) ? '#f59e0b' : 'none'"
                :stroke="i <= (hoverRating || rating) ? '#f59e0b' : 'currentColor'"
                stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
            <span v-if="rating" class="rating-label">{{ rating }}/5</span>
          </div>
        </div>

        <div class="field">
          <label>Tags</label>
          <div class="tag-input-wrapper">
            <div v-if="tags.length" class="tags-list">
              <span v-for="tag in tags" :key="tag" class="tag">
                {{ tag }}
                <button class="tag-remove" @click="removeTag(tag)">&times;</button>
              </span>
            </div>
            <input
              v-model="tagInput"
              type="text"
              placeholder="Add tag and press Enter..."
              @keyup.enter="addTag"
            />
          </div>
        </div>

        <div class="field">
          <label>Notes</label>
          <textarea v-model="notes" placeholder="Add notes..." rows="2"></textarea>
        </div>

        <div class="coords">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          {{ lat.toFixed(5) }}, {{ lng.toFixed(5) }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-save" @click="save" :disabled="!name.trim()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          Save Place
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.modal {
  background: var(--bg-glass);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid var(--border-light);
  border-bottom: none;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  padding-bottom: calc(var(--safe-bottom) + 8px);
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.modal-handle {
  display: flex;
  justify-content: center;
  padding: 10px 0 2px;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 22px 14px;

  h3 {
    font-size: 18px;
    font-weight: 700;
  }
}

.close-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border-radius: 50%;
  border: 1px solid var(--border);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.modal-body {
  padding: 4px 22px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row-2 {
  display: flex;
  gap: 12px;

  .field {
    flex: 1;
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input, select, textarea {
    padding: 12px 14px;
    background: var(--bg-glass-light);
    color: var(--text-primary);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    -webkit-appearance: none;

    &:focus {
      @include input-focus;
    }
  }

  textarea {
    resize: vertical;
    min-height: 50px;
  }

  select {
    cursor: pointer;
  }

  input::placeholder, textarea::placeholder {
    color: var(--text-muted);
  }
}

// Star rating
.star-rating {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-btn {
  background: none;
  padding: 4px;
  color: var(--text-muted);
  display: flex;
  align-items: center;

  &:active {
    transform: scale(1.2);
  }
}

.rating-label {
  margin-left: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

// Tags
.tag-input-wrapper {
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:focus-within {
    @include input-focus;
  }

  input {
    background: none;
    border: none;
    padding: 4px;
    color: var(--text-primary);

    &:focus {
      box-shadow: none;
    }
  }
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: $accent-light;
  color: $accent;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
}

.tag-remove {
  background: none;
  color: $accent;
  font-size: 16px;
  line-height: 1;
  padding: 0;
}

.coords {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  padding: 10px 14px;
  background: var(--bg-glass-light);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid var(--border);
}

.btn-cancel {
  flex: 1;
  padding: 14px 20px;
  background: var(--bg-glass-light);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 15px;
  font-weight: 500;

  &:hover {
    background: var(--bg-hover);
  }
}

.btn-save {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 22px;
  background: $accent;
  color: white;
  border-radius: var(--radius-full);
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 4px 16px $accent-muted;

  &:hover:not(:disabled) {
    background: $accent-hover;
    box-shadow: 0 6px 24px var(--glow-accent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Desktop: center the modal
@media (min-width: 769px) {
  .modal-overlay {
    align-items: center;
  }

  .modal {
    border-radius: var(--radius-xl);
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 0;
    max-width: 500px;
    animation-name: scaleIn;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-handle {
    display: none;
  }
}
</style>
