<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const mode = ref('login')
const email = ref('')
const password = ref('')
const name = ref('')
const handle = ref('')
const handleStatus = ref('') // '', 'checking', 'available', 'taken', 'invalid'
const handleSuggestions = ref([])
const error = ref('')
const submitting = ref(false)

let handleCheckTimer = null

watch(handle, (val) => {
  if (!val || val.length < 3) {
    handleStatus.value = val ? 'invalid' : ''
    return
  }
  if (!/^[a-z0-9_]{3,20}$/.test(val)) {
    handleStatus.value = 'invalid'
    return
  }
  handleStatus.value = 'checking'
  clearTimeout(handleCheckTimer)
  handleCheckTimer = setTimeout(async () => {
    try {
      const available = await authStore.checkHandle(val)
      handleStatus.value = available ? 'available' : 'taken'
    } catch {
      handleStatus.value = ''
    }
  }, 400)
})

async function onNameBlur() {
  if (mode.value === 'register' && name.value.trim()) {
    try {
      handleSuggestions.value = await authStore.suggestHandles(name.value)
    } catch { /* silent */ }
  }
}

function pickSuggestion(s) {
  handle.value = s
}

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    if (mode.value === 'login') {
      await authStore.login(email.value, password.value)
    } else {
      await authStore.register(email.value, password.value, name.value, handle.value || undefined)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}

function toggle() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
  handleStatus.value = ''
  handleSuggestions.value = []
}
</script>

<template>
  <div class="auth-overlay">
    <div class="auth-card">
      <div class="auth-header">
        <h1 class="auth-logo">Mappsly</h1>
        <p class="auth-subtitle">{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</p>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <div v-if="mode === 'register'" class="field">
          <label for="name">Name</label>
          <input id="name" v-model="name" type="text" placeholder="Your name" autocomplete="name" @blur="onNameBlur" />
        </div>

        <div v-if="mode === 'register'" class="field">
          <label for="handle">User ID</label>
          <div class="handle-input-wrap">
            <span class="handle-prefix">#</span>
            <input
              id="handle"
              v-model="handle"
              type="text"
              placeholder="your_id"
              autocomplete="off"
              maxlength="20"
              class="handle-input"
            />
            <span v-if="handleStatus === 'checking'" class="handle-status checking">...</span>
            <span v-else-if="handleStatus === 'available'" class="handle-status available">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span v-else-if="handleStatus === 'taken'" class="handle-status taken">taken</span>
            <span v-else-if="handleStatus === 'invalid'" class="handle-status invalid">3-20, a-z 0-9 _</span>
          </div>
          <div v-if="handleSuggestions.length && !handle" class="handle-suggestions">
            <button
              v-for="s in handleSuggestions" :key="s"
              type="button"
              class="suggestion-chip"
              @click="pickSuggestion(s)"
            >
              #{{ s }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" placeholder="you@example.com" required autocomplete="email" />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" placeholder="Password" required autocomplete="current-password" minlength="6" />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="auth-submit" :disabled="submitting">
          {{ submitting ? 'Please wait...' : (mode === 'login' ? 'Sign in' : 'Create account') }}
        </button>
      </form>

      <p class="auth-toggle">
        {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
        <button @click="toggle" class="toggle-btn">
          {{ mode === 'login' ? 'Sign up' : 'Sign in' }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.auth-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-void);
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-xl);
  padding: 40px 32px;
  box-shadow: var(--shadow-lg);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-logo {
  font-size: 28px;
  font-weight: 700;
  color: $accent;
  margin-bottom: 8px;
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
}

.auth-subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  input {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius);
    padding: 12px 14px;
    color: var(--text-primary);
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color var(--transition);

    &:focus {
      border-color: $accent;
      box-shadow: 0 0 0 3px $accent-muted;
    }

    &::placeholder {
      color: var(--text-muted);
    }
  }
}

// Handle input
.handle-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  transition: border-color var(--transition);

  &:focus-within {
    border-color: $accent;
  }
}

.handle-prefix {
  padding: 12px 0 12px 14px;
  color: var(--text-muted);
  font-size: 15px;
  font-weight: 600;
}

.handle-input {
  flex: 1;
  background: none !important;
  border: none !important;
  padding: 12px 8px !important;
  color: var(--text-primary);
  font-size: 15px;
  outline: none;
  min-width: 0;

  &:focus {
    border: none !important;
    box-shadow: none !important;
  }
}

.handle-status {
  padding: 0 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;

  &.checking { color: var(--text-muted); }
  &.available { color: #22c55e; display: flex; }
  &.taken { color: var(--danger); }
  &.invalid { color: var(--text-muted); font-size: 10px; }
}

.handle-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.suggestion-chip {
  padding: 4px 12px;
  background: $accent-light;
  color: $accent;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: $accent;
    color: white;
  }
}

.auth-error {
  color: var(--danger);
  font-size: 13px;
  text-align: center;
}

.auth-submit {
  background: $accent;
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  padding: 13px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background var(--transition);
  margin-top: 4px;
  box-shadow: 0 4px 16px $accent-muted;

  &:hover:not(:disabled) {
    background: $accent-hover;
    box-shadow: 0 6px 24px var(--glow-accent);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.auth-toggle {
  text-align: center;
  margin-top: 24px;
  font-size: 13px;
  color: var(--text-muted);
}

.toggle-btn {
  background: none;
  border: none;
  color: $accent;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  margin-left: 4px;

  &:hover {
    color: $accent-hover;
  }
}
</style>
