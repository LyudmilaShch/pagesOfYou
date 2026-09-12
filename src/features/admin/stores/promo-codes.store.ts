import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  adminPromoCodesApi,
  type AdminPromoCode,
  type PromoCodePayload,
  type PromoCodesQuery,
  type UpdatePromoCodePayload,
} from '@/shared/api/admin/promo-codes.api'

export const usePromoCodesStore = defineStore('adminPromoCodes', () => {
  const items = ref<AdminPromoCode[]>([])
  const total = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadPromoCodes(query: PromoCodesQuery = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await adminPromoCodesApi.list(query)
      items.value = result.items
      total.value = result.total
      totalPages.value = result.totalPages
    } catch (err) {
      error.value = extractMessage(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createPromoCode(payload: PromoCodePayload): Promise<AdminPromoCode> {
    const item = await adminPromoCodesApi.create(payload)
    items.value.unshift(item)
    total.value += 1
    return item
  }

  async function updatePromoCode(id: string, payload: UpdatePromoCodePayload): Promise<AdminPromoCode> {
    const updated = await adminPromoCodesApi.update(id, payload)
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function deletePromoCode(id: string): Promise<void> {
    await adminPromoCodesApi.remove(id)
    items.value = items.value.filter((i) => i.id !== id)
    total.value = Math.max(0, total.value - 1)
  }

  function extractMessage(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      return e.response?.data?.message ?? e.message ?? 'Произошла ошибка'
    }
    return 'Произошла ошибка'
  }

  return {
    items,
    total,
    totalPages,
    loading,
    error,
    loadPromoCodes,
    createPromoCode,
    updatePromoCode,
    deletePromoCode,
  }
})
