import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { CatalogItem } from '@/types/catalog.types'

export const useCatalogStore = defineStore('catalog', () => {
  const items = ref<CatalogItem[]>([])

  return {
    items,
  }
})
