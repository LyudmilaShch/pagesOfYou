import { ref } from 'vue'

import { defineStore } from 'pinia'

import { catalogApi } from '../api/catalog.api'
import type { MagazineType } from '../types/magazine-type'

export const useOrderBuilderStore = defineStore('orderBuilder', () => {
  // ── Catalog ────────────────────────────────────────────────────────────────
  const magazineTypes = ref<MagazineType[]>([])
  const isLoadingTypes = ref(false)
  const loadError = ref<string | null>(null)

  async function fetchMagazineTypes(): Promise<void> {
    if (magazineTypes.value.length > 0) return // already loaded
    isLoadingTypes.value = true
    loadError.value = null
    try {
      magazineTypes.value = await catalogApi.getMagazineTypes()
    } catch {
      loadError.value = 'Не удалось загрузить список журналов. Попробуйте ещё раз.'
    } finally {
      isLoadingTypes.value = false
    }
  }

  // ── Step 1 — Magazine type ─────────────────────────────────────────────────
  const selectedMagazineType = ref<MagazineType | null>(null)

  function selectMagazineType(type: MagazineType): void {
    selectedMagazineType.value = type
  }

  function clearSelection(): void {
    selectedMagazineType.value = null
  }

  // ── Future steps can be added here ────────────────────────────────────────

  return {
    // Catalog
    magazineTypes,
    isLoadingTypes,
    loadError,
    fetchMagazineTypes,
    // Step 1
    selectedMagazineType,
    selectMagazineType,
    clearSelection,
  }
})
