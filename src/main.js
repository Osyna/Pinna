import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { IonicVue } from '@ionic/vue'
import App from './App.vue'

import 'maplibre-gl/dist/maplibre-gl.css'

/* Ionic core CSS */
import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'

/* Ionic optional CSS utils */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'

/* App styles (after Ionic, so we can override) */
import './styles/main.scss'
/* Cartoon game theme — the app's default look */
import './styles/cartoon.scss'

const app = createApp(App)
app.use(createPinia())
app.use(IonicVue, {
  mode: 'ios',
})

/* Ionic requires router.isReady() but we don't use router - mount directly */
app.mount('#app')

/* Register service worker for tile caching */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
