<template>
  <v-dialog :model-value="modelValue" max-width="420" @update:model-value="onDialogUpdate">
    <v-card>
      <v-card-title>{{ title }}</v-card-title>
      <v-divider />
      <v-card-text>
        <v-autocomplete
          v-model="selectedId"
          :items="items"
          item-title="name"
          item-value="id"
          label="Тип журнала"
          variant="outlined"
          density="comfortable"
          :loading="loadingItems"
          no-data-text="Ничего не найдено"
          hide-details="auto"
          @update:search="onSearch"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Отмена</v-btn>
        <v-btn
          color="primary"
          :disabled="!selectedId"
          :loading="loading"
          @click="confirm"
        >
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import {
  adminMagazineTypesApi,
  type AdminMagazineType,
} from '@/shared/api/admin/magazine-types.api'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    excludeId: string
    title?: string
    confirmLabel?: string
    loading?: boolean
  }>(),
  {
    title: 'Выберите тип журнала',
    confirmLabel: 'Дублировать',
    loading: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [targetTypeId: string]
}>()

const items = ref<AdminMagazineType[]>([])
const loadingItems = ref(false)
const selectedId = ref<string | null>(null)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

async function loadItems(search = ''): Promise<void> {
  loadingItems.value = true
  try {
    const result = await adminMagazineTypesApi.list({ search: search || undefined, limit: 50 })
    items.value = result.items.filter((item) => item.id !== props.excludeId)
  } finally {
    loadingItems.value = false
  }
}

function onSearch(search: string): void {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    void loadItems(search)
  }, 350)
}

function onDialogUpdate(value: boolean): void {
  emit('update:modelValue', value)
}

function close(): void {
  emit('update:modelValue', false)
}

function confirm(): void {
  if (!selectedId.value) {
    return
  }
  emit('confirm', selectedId.value)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedId.value = null
      void loadItems()
    }
  },
)
</script>
