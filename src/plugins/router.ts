import { createRouter, createWebHistory } from 'vue-router'

import { routes } from '@/router/routes'
import { ADMIN_TOKEN_KEY } from '@/features/admin/api/admin-http'
import { useAdminAuthStore } from '@/features/admin/stores/admin-auth.store'
import { useAuthStore } from '@/stores/auth.store'
import { scrollToSection, scrollToTop, waitForSection } from '@/utils/scroll'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }

    if (to.hash) {
      return waitForSection(to.hash).then((found) => {
        if (found) {
          scrollToSection(to.hash)
        }
        return false
      })
    }

    scrollToTop()
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const adminStore = useAdminAuthStore()

  // Puppeteer opens the print route with the export token in the query. Store it before any
  // request, so the admin client does not call the API anonymously and then bounce to login.
  const printToken = to.name === 'admin-order-print' ? to.query.token : undefined
  if (typeof printToken === 'string' && printToken) {
    localStorage.setItem(ADMIN_TOKEN_KEY, printToken)
  }

  // ── Admin guard ──────────────────────────────────────────────────────────
  if (to.meta.requiresAdmin && !adminStore.isAuthenticated) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }

  // Already logged-in admin trying to access login page → redirect to dashboard
  if (to.meta.requiresAdminGuest && adminStore.isAuthenticated) {
    return { name: 'admin-dashboard' }
  }

  // ── User guard ───────────────────────────────────────────────────────────
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'auth', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    return { name: 'account' }
  }
})
