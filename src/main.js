import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

import 'maplibre-gl/dist/maplibre-gl.css'

/* App styles */
import './styles/main.scss'
/* Cartoon game theme — the app's default look */
import './styles/cartoon.scss'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

/* Register service worker for tile + API caching */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
