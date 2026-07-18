import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@/styles/main.scss'

import { createApp } from 'vue'

import App from '@/App.vue'
import { registerPlugins } from '@/plugins'
import { pinia } from '@/plugins/pinia'
import { useAdminAuthStore } from '@/features/admin/stores/admin-auth.store'
import { useAuthStore } from '@/stores/auth.store'

const app = createApp(App)

if (import.meta.env.DEV) {
  // vue-konva's Group component renders its slot content directly (no wrapping element), so Vue
  // can't auto-inherit event-listener attrs (mousedown/dragmove/transform/etc.) onto a single
  // root — it warns on every such component update. vue-konva binds these listeners itself,
  // directly on the underlying Konva node, bypassing Vue's attrs-fallthrough entirely, so the
  // listeners work correctly regardless; this is purely a known, harmless console-noise quirk of
  // the library (not fixable from application code) — filter it out, keep everything else.
  app.config.warnHandler = (msg, _instance, trace) => {
    if (msg.includes('Extraneous non-emits event listeners') && msg.includes('fragment or text root nodes')) {
      return
    }

    console.warn(`[Vue warn]: ${msg}${trace}`)
  }
}

registerPlugins(app)

// Restore auth state from localStorage before first render
const authStore = useAuthStore(pinia)
authStore.initFromStorage()

const adminStore = useAdminAuthStore(pinia)
adminStore.initFromStorage()

app.mount('#app')
