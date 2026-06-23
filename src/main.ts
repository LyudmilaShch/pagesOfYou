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

registerPlugins(app)

// Restore auth state from localStorage before first render
const authStore = useAuthStore(pinia)
authStore.initFromStorage()

const adminStore = useAdminAuthStore(pinia)
adminStore.initFromStorage()

app.mount('#app')
