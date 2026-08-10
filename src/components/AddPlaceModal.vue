<script setup>
import { reactive, ref, onMounted } from 'vue'
import { usePlacesStore } from '../stores/places'
import { hapticTap, hapticSuccess } from '../composables/useHaptics'
import { showToast } from '../composables/useToast'
import PlaceFormFields from './PlaceFormFields.vue'

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

const form = reactive({
  name: props.initialName || (props.initialAddress ? props.initialAddress.split(',')[0] : ''),
  address: props.initialAddress,
  website: props.initialWebsite || '',
  category: props.initialCategory || 'other',
  cuisine: props.initialCuisine || 'None',
  rating: 0,
  tags: [...(props.initialTags || [])],
  notes: '',
})

function onFormUpdate(next) {
  Object.assign(form, next)
}

const modalBodyRef = ref(null)
const dragY = ref(0)
const dragging = ref(false)
const startY = ref(0)

function save() {
  if (!form.name.trim()) return
  store.addPlace({
    name: form.name.trim(),
    lat: props.lat,
    lng: props.lng,
    address: form.address,
    category: form.category,
    notes: form.notes.trim(),
    rating: form.rating,
    cuisine: form.cuisine,
    tags: form.tags,
    website: form.website.trim(),
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
        <h2>Save Place</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body" ref="modalBodyRef">
        <PlaceFormFields :model-value="form" autofocus-name @update:model-value="onFormUpdate" @submit="save" />

        <div class="coords-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          {{ lat.toFixed(5) }}, {{ lng.toFixed(5) }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
        <button class="btn-save" @click="save" :disabled="!form.name.trim()">
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
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
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

  h2 {
    font-size: 19px;
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

.coords-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-family: monospace;
  padding: 11px 15px;
  border-radius: 14px;
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
    from { opacity: 0; transform: scale(0.95) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .modal-handle {
    display: none;
  }
}
</style>
