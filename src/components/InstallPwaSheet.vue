<script setup>
import { usePwaInstall } from '../composables/usePwaInstall'
import { hapticTap, hapticSuccess } from '../composables/useHaptics'

const { show, platform, canNativeInstall, dismiss, promptNativeInstall } = usePwaInstall()

async function handleNativeInstall() {
  hapticTap()
  const outcome = await promptNativeInstall()
  if (outcome === 'accepted') hapticSuccess()
  dismiss()
}

function handleClose() {
  hapticTap()
  dismiss()
}
</script>

<template>
  <div v-if="show" class="modal-overlay pwa-overlay" @click.self="handleClose">
    <div class="modal pwa-sheet">
      <div class="modal-handle">
        <div class="handle-bar"></div>
      </div>

      <div class="pwa-head">
        <img src="/icons/icon-192.png" class="pwa-app-icon" alt="" />
        <div class="pwa-head-text">
          <h2>Install Pinna</h2>
          <p>Add it to your home screen — it opens like a real app, works offline, and skips the browser bar.</p>
        </div>
        <button class="close-btn" aria-label="Close" @click="handleClose">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Any browser that exposes the native install prompt (Android Chrome,
           desktop Chrome/Edge): one tap does everything -->
      <div v-if="canNativeInstall" class="pwa-native">
        <button class="pwa-install-btn" @click="handleNativeInstall">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Install App
        </button>
      </div>

      <!-- iOS Safari: no install API exists, walk through Share -> Add to Home Screen -->
      <div v-else-if="platform === 'ios'" class="pwa-steps">
        <div class="pwa-step">
          <span class="pwa-step-num">1</span>
          <span class="pwa-step-text">
            Tap
            <span class="pwa-inline-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </span>
            <strong>Share</strong> in Safari's toolbar
          </span>
        </div>
        <div class="pwa-step">
          <span class="pwa-step-num">2</span>
          <span class="pwa-step-text">
            Scroll down and tap
            <span class="pwa-inline-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </span>
            <strong>Add to Home Screen</strong>
          </span>
        </div>
        <div class="pwa-step">
          <span class="pwa-step-num">3</span>
          <span class="pwa-step-text">Tap <strong>Add</strong> in the top-right corner</span>
        </div>
      </div>

      <!-- Android without a captured native prompt yet (or a non-Chrome browser) -->
      <div v-else-if="platform === 'android'" class="pwa-steps">
        <div class="pwa-step">
          <span class="pwa-step-num">1</span>
          <span class="pwa-step-text">
            Tap the
            <span class="pwa-inline-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
                <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </span>
            <strong>menu</strong> in your browser's toolbar
          </span>
        </div>
        <div class="pwa-step">
          <span class="pwa-step-num">2</span>
          <span class="pwa-step-text">Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></span>
        </div>
      </div>

      <!-- Desktop / anything else without a native install path -->
      <div v-else class="pwa-steps">
        <p class="pwa-generic-note">Open this page on your phone's browser to install Pinna as an app.</p>
      </div>

      <button class="pwa-done-btn" @click="handleClose">Got it</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Vue's scoped styles don't cross component boundaries — reusing the
   .modal-overlay/.modal class NAMES here only picks up cartoon.scss's
   colors (which are global), not AddPlaceModal's own scoped position/
   z-index rules. Declare the structural half ourselves, above the
   bottom tab bar (z-index: 1100) so every control stays clickable. */
.pwa-overlay {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(46, 33, 64, 0.35);
}

.pwa-sheet {
  position: relative;
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  animation: pwaSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  padding: 0 22px calc(var(--safe-bottom) + 20px);
}

@keyframes pwaSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.pwa-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0 18px;

  .close-btn {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.pwa-app-icon {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 16px;
}

.pwa-head-text {
  flex: 1;
  min-width: 0;

  h2 {
    font-size: 19px;
    margin-bottom: 4px;
  }

  p {
    font-size: 12.5px;
    line-height: 1.4;
    color: var(--text-secondary);
  }
}

.pwa-native {
  padding-bottom: 6px;
}

.pwa-install-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  padding: 15px 0;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;

  &:active { transform: translateY(2px); }
}

.pwa-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 8px;
}

.pwa-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
}

.pwa-step-num {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}

.pwa-step-text {
  flex: 1;
  font-size: 13.5px;
  line-height: 1.5;
}

.pwa-inline-icon {
  display: inline-flex;
  vertical-align: -3px;
  margin: 0 2px;
}

.pwa-generic-note {
  padding: 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.pwa-done-btn {
  width: 100%;
  padding: 13px 0;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;

  &:active { transform: translateY(2px); }
}
</style>
