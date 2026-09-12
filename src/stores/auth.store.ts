import { computed, ref } from 'vue'

import { defineStore } from 'pinia'

import { authApi } from '@/shared/api/auth.api'
import { usersApi, type UpdateMePayload } from '@/shared/api/users.api'
import type { AuthUser } from '@/types/user.types'

const STORAGE_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
} as const

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const userPhone = computed(() => user.value?.phone ?? null)

  // Persist tokens in localStorage and reactive state simultaneously
  function setTokens(access: string, refresh: string): void {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem(STORAGE_KEYS.accessToken, access)
    localStorage.setItem(STORAGE_KEYS.refreshToken, refresh)
  }

  function clearTokens(): void {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem(STORAGE_KEYS.accessToken)
    localStorage.removeItem(STORAGE_KEYS.refreshToken)
  }

  // Restore state from localStorage (called once on app startup)
  function initFromStorage(): void {
    const storedAccess = localStorage.getItem(STORAGE_KEYS.accessToken)
    const storedRefresh = localStorage.getItem(STORAGE_KEYS.refreshToken)

    if (storedAccess && storedRefresh) {
      accessToken.value = storedAccess
      refreshToken.value = storedRefresh
      // user is restored lazily — the /account page can fetch /users/me when needed
      // For MVP we store user in localStorage as well
      const storedUser = localStorage.getItem('authUser')
      if (storedUser) {
        try {
          user.value = JSON.parse(storedUser) as AuthUser
        } catch {
          // ignore corrupt data
        }
      }
    }
  }

  // Actions
  async function sendCode(phone: string): Promise<{ expiresIn: number }> {
    const result = await authApi.sendCode(phone)
    return { expiresIn: result.expiresIn }
  }

  async function verifyCode(phone: string, code: string): Promise<void> {
    const result = await authApi.verifyCode(phone, code)

    const authUser: AuthUser = {
      id: result.user.id,
      phone: result.user.phone,
      name: result.user.name,
      userNumber: result.user.userNumber,
      avatarUrl: result.user.avatarUrl,
      role: result.user.role,
      isNew: result.user.isNew,
    }

    user.value = authUser
    setTokens(result.accessToken, result.refreshToken)
    localStorage.setItem('authUser', JSON.stringify(authUser))
  }

  async function applyProfileUpdate(payload: UpdateMePayload): Promise<void> {
    const result = await usersApi.updateMe(payload)
    if (!user.value) {
      return
    }

    user.value = { ...user.value, name: result.name, avatarUrl: result.avatarUrl }
    localStorage.setItem('authUser', JSON.stringify(user.value))
  }

  /** Empty string clears the name back to the "Пользователь #{userNumber}" fallback. */
  function updateName(name: string): Promise<void> {
    return applyProfileUpdate({ name })
  }

  /** Empty string removes the current avatar. */
  function updateAvatar(avatarUrl: string): Promise<void> {
    return applyProfileUpdate({ avatarUrl })
  }

  async function refresh(): Promise<boolean> {
    const storedRefresh = refreshToken.value ?? localStorage.getItem(STORAGE_KEYS.refreshToken)
    if (!storedRefresh) return false

    try {
      const result = await authApi.refreshToken(storedRefresh)
      setTokens(result.accessToken, result.refreshToken)
      return true
    } catch {
      clearTokens()
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // Always clear local state even if backend request fails
    } finally {
      clearTokens()
      localStorage.removeItem('authUser')
    }
  }

  return {
    // State
    user,
    accessToken,
    refreshToken,
    // Getters
    isAuthenticated,
    userPhone,
    // Actions
    initFromStorage,
    sendCode,
    verifyCode,
    updateName,
    updateAvatar,
    refresh,
    logout,
  }
})
