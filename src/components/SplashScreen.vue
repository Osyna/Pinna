<script setup>
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  isVisible: { type: Boolean, default: true },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['finish'])

const splashRef = ref(null)
const isExiting = ref(false)
const isExpanding = ref(false)
const minTimeElapsed = ref(false)

onMounted(() => {
  // Ensure a minimum splash duration for the animation to be seen
  setTimeout(() => {
    minTimeElapsed.value = true
    checkExit()
  }, 2200)
})

function checkExit() {
  if (minTimeElapsed.value && !props.loading && !isExpanding.value) {
    isExpanding.value = true
    // Wait for expansion to fill screen (approx 0.6s) then fade out
    setTimeout(() => {
      isExiting.value = true
      setTimeout(() => {
        emit('finish')
      }, 1000) // Slightly longer fade for cinematic feel
    }, 600)
  }
}

// Watch loading property to trigger exit if min time is already elapsed
watch(() => props.loading, (newVal) => {
  if (!newVal) checkExit()
})
</script>

<template>
  <div v-if="isVisible" ref="splashRef" :class="['splash-container', { 'exit': isExiting }]">
    <!-- Fullscreen Expansion Circle -->
    <div :class="['expansion-circle', { 'grow': isExpanding }]"></div>

    <div class="splash-content">
      <div class="logo-wrapper">
        <!-- Main Logo (Glow removed for cleaner look) -->
        <svg class="main-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="gemini-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#6366f1"/>
              <stop offset="50%" style="stop-color:#8b5cf6"/>
              <stop offset="100%" style="stop-color:#d946ef"/>
            </linearGradient>
            <filter id="logo-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>
          <circle cx="50" cy="50" r="46" fill="url(#gemini-gradient)" class="logo-circle" />
          <path d="M50 18 C38 18 28 28 28 40 C28 58 50 80 50 80 C50 80 72 58 72 40 C72 28 62 18 50 18Z" fill="white" class="logo-pin" />
          <circle cx="50" cy="39" r="10" fill="url(#gemini-gradient)" class="logo-inner-circle" />
        </svg>

        <!-- Dynamic Sparkles -->
        <div class="sparkles">
          <div class="sparkle s1"></div>
          <div class="sparkle s2"></div>
          <div class="sparkle s3"></div>
          <div class="sparkle s4"></div>
        </div>
      </div>
      <h1 class="brand-name">Pinna</h1>
      <p class="tagline">Discovery reimagined</p>
    </div>

    <!-- Background Orbs (Enhanced) -->
    <div class="ambient-glow">
      <div class="ambient-orb ambient-orb--violet"></div>
      <div class="ambient-orb ambient-orb--magenta"></div>
      <div class="ambient-orb ambient-orb--indigo"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.splash-container {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  // Glassmorphism base
  background: rgba(13, 13, 18, 0.45);
  backdrop-filter: blur(60px) saturate(180%);
  -webkit-backdrop-filter: blur(60px) saturate(180%);
  overflow: hidden;

  // Glass highlights
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% -20%, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
    pointer-events: none;
  }

  &.exit {
    animation: splash-fade-out 0.8s var(--ease-out-expo) forwards;
  }
}

.splash-content {
  position: relative;
  z-index: 2;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  border-radius: var(--radius-2xl);
}

.logo-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  margin-bottom: 24px;
}

.expansion-circle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  background: #8b5cf6;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
  pointer-events: none;
  z-index: 1;

  &.grow {
    animation: expansion-grow 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards;
  }
}

.main-logo {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 2;
  animation: gemini-pulse 2s ease-in-out infinite;

  .logo-circle {
    // Glow removed for cleaner aesthetic
  }
}

.brand-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, #fff 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.02em;
  margin: 0;
  opacity: 0;
  transform: translateY(10px);
  animation: stagger-in 0.6s var(--ease-out-expo) 0.3s forwards;
}

.tagline {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 500;
  margin-top: 4px;
  opacity: 0;
  transform: translateY(10px);
  animation: stagger-in 0.6s var(--ease-out-expo) 0.5s forwards;
}

/* Sparkles */
.sparkles {
  position: absolute;
  inset: -10px;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: white;
  clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
  opacity: 0;

  &.s1 { top: 0; right: 10%; animation: gemini-sparkle 1.5s ease-in-out 0.2s infinite; }
  &.s2 { bottom: 10%; left: 0; animation: gemini-sparkle 1.8s ease-in-out 0.5s infinite; }
  &.s3 { top: 20%; left: 10%; animation: gemini-sparkle 1.2s ease-in-out 0.8s infinite; }
  &.s4 { bottom: 0; right: 5%; animation: gemini-sparkle 2s ease-in-out 1s infinite; }
}

/* Enhanced Background Orbs */
.ambient-orb {
  &--violet {
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
    top: -100px; right: -100px;
    animation: float 15s ease-in-out infinite;
  }
  &--magenta {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(217, 70, 239, 0.1) 0%, transparent 70%);
    bottom: -100px; left: -100px;
    animation: float 18s ease-in-out -5s infinite;
  }
  &--indigo {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%);
    top: 30%; left: 20%;
    animation: float 20s ease-in-out -2s infinite;
  }
}
</style>
