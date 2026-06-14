import { createRouter, createWebHistory } from 'vue-router'

import { routes } from '@/router/routes'
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

        // Prevent Vue Router from resetting scroll to top
        return false
      })
    }

    scrollToTop()
    return { top: 0 }
  },
})
