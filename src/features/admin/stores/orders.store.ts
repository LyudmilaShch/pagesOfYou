import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  adminOrdersApi,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type AdminOrdersQuery,
} from '@/shared/api/admin/orders.api'

export const useAdminOrdersStore = defineStore('adminOrders', () => {
  const items = ref<AdminOrderListItem[]>([])
  const total = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const current = ref<AdminOrderDetail | null>(null)
  const loadingCurrent = ref(false)

  async function loadOrders(query: AdminOrdersQuery = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await adminOrdersApi.list(query)
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

  async function loadOrder(id: string): Promise<void> {
    loadingCurrent.value = true
    error.value = null
    try {
      current.value = await adminOrdersApi.getOne(id)
    } catch (err) {
      error.value = extractMessage(err)
      throw err
    } finally {
      loadingCurrent.value = false
    }
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
    current,
    loadingCurrent,
    loadOrders,
    loadOrder,
  }
})
