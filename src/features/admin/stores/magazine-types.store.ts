import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  adminMagazineTypesApi,
  type AdminMagazineType,
  type CreateMagazineTypePayload,
  type MagazineTypesQuery,
  type UpdateMagazineTypePayload,
} from '@/shared/api/admin/magazine-types.api'

export const useMagazineTypesStore = defineStore('adminMagazineTypes', () => {
  const items = ref<AdminMagazineType[]>([])
  const total = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadMagazineTypes(query: MagazineTypesQuery = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await adminMagazineTypesApi.list(query)
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

  async function createMagazineType(payload: CreateMagazineTypePayload): Promise<AdminMagazineType> {
    const item = await adminMagazineTypesApi.create(payload)
    // Prepend to list so it's immediately visible
    items.value.unshift(item)
    total.value += 1
    return item
  }

  async function updateMagazineType(id: string, payload: UpdateMagazineTypePayload): Promise<AdminMagazineType> {
    const updated = await adminMagazineTypesApi.update(id, payload)
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function deleteMagazineType(id: string): Promise<void> {
    await adminMagazineTypesApi.remove(id)
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
    loadMagazineTypes,
    createMagazineType,
    updateMagazineType,
    deleteMagazineType,
  }
})
