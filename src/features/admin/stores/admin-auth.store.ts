import { computed, ref } from 'vue'

import { defineStore } from 'pinia'

import { adminAuthApi, type AdminUser } from '../api/admin-auth.api'
import { ADMIN_TOKEN_KEY, clearAdminToken, getAdminToken } from '../api/admin-http'

export const useAdminAuthStore = defineStore('adminAuth', () => {
  const admin = ref<AdminUser | null>(null)
  const accessToken = ref<string | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value && !!admin.value)
  const adminEmail = computed(() => admin.value?.email ?? null)

  function initFromStorage(): void {
    const token = getAdminToken()
    if (!token) return

    accessToken.value = token
    const stored = localStorage.getItem('adminUser')
    if (stored) {
      try {
        admin.value = JSON.parse(stored) as AdminUser
      } catch {
        // ignore corrupt data
      }
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const result = await adminAuthApi.login({ email, password })
    accessToken.value = result.accessToken
    admin.value = result.admin
    localStorage.setItem(ADMIN_TOKEN_KEY, result.accessToken)
    localStorage.setItem('adminUser', JSON.stringify(result.admin))
  }

  async function logout(): Promise<void> {
    try {
      await adminAuthApi.logout()
    } catch {
      // Always clear local state
    } finally {
      accessToken.value = null
      admin.value = null
      clearAdminToken()
    }
  }

  async function fetchMe(): Promise<void> {
    const me = await adminAuthApi.getMe()
    admin.value = me
    localStorage.setItem('adminUser', JSON.stringify(me))
  }

  return {
    admin,
    accessToken,
    isAuthenticated,
    adminEmail,
    initFromStorage,
    login,
    logout,
    fetchMe,
  }
})
