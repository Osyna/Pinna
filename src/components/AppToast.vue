<script setup>
import { useToast, dismissToast } from '../composables/useToast'
const { toasts } = useToast()

function runAction(t) {
  try { t.action.handler() } finally { dismissToast(t.id) }
}
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
        <svg v-if="t.type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <svg v-else-if="t.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>{{ t.message }}</span>
        <button v-if="t.action" class="toast-action" @click="runAction(t)">{{ t.action.label }}</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped lang="scss">
.toast-action {
  margin-left: 6px;
  flex-shrink: 0;
  background: var(--accent-light);
  color: var(--accent);
  border: none;
  border-radius: 10px;
  padding: 5px 12px;
  font-weight: 900;
  font-size: 12.5px;
  cursor: pointer;
}

.toast-container {
  position: fixed;
  top: calc(var(--safe-top) + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: 90%;
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: var(--bg-glass);
  backdrop-filter: var(--blur-heavy);
  -webkit-backdrop-filter: var(--blur-heavy);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  pointer-events: auto;
  width: 100%;

  &.success svg { color: var(--success); }
  &.error svg { color: var(--danger); }
  &.info svg { color: var(--accent); }
}

.toast-enter-active {
  animation: toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  animation: toastOut 0.2s ease forwards;
}

@keyframes toastIn {
  from { opacity: 0; transform: translateY(-12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes toastOut {
  to { opacity: 0; transform: translateY(-8px) scale(0.95); }
}
</style>
