<template>
  <div class="default-spreads-tab">
    <div class="default-spreads-tab__header">
      <div>
        <h2 class="default-spreads-tab__title">Развороты по умолчанию</h2>
        <p class="default-spreads-tab__subtitle">
          Эти шаблоны будут автоматически подставлены при создании журнала пользователем.
          Минимум {{ MIN_JOURNAL_SPREADS }} разворотов.
        </p>
      </div>
      <div class="default-spreads-tab__header-actions">
        <v-btn variant="outlined" prepend-icon="mdi-plus" @click="addSpread">
          Добавить разворот
        </v-btn>
        <v-btn color="primary" :loading="saving" @click="save">Сохранить</v-btn>
      </div>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-alert
      v-if="!loading && pages.length === 0"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      Сначала добавьте шаблоны страниц на вкладке «Страницы журнала».
    </v-alert>

    <v-alert
      v-else-if="!loading && spreads.length === 0"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Развороты по умолчанию ещё не настроены.
      <v-btn class="ml-2" size="small" variant="text" @click="initializeDefaults">
        Создать {{ MIN_JOURNAL_SPREADS }} разворотов
      </v-btn>
    </v-alert>

    <div v-else class="default-spreads-tab__list">
      <div
        v-for="(spread, index) in spreads"
        :key="spread.key"
        class="default-spreads-tab__item"
        :class="{ 'default-spreads-tab__item--dragging': draggingKey === spread.key }"
        draggable="true"
        @dragstart="onDragStart(spread.key)"
        @dragover.prevent
        @drop="onDrop(spread.key)"
        @dragend="draggingKey = null"
      >
        <div class="default-spreads-tab__drag" aria-hidden="true">
          <v-icon size="18">mdi-drag-vertical</v-icon>
        </div>

        <span class="default-spreads-tab__index">{{ index + 1 }}</span>

        <v-select
          v-model="spread.layoutMode"
          :items="layoutModeItems"
          item-title="label"
          item-value="value"
          label="Тип"
          density="compact"
          variant="outlined"
          hide-details
          class="default-spreads-tab__layout"
        />

        <v-select
          v-model="spread.magazinePageId"
          :items="spread.layoutMode === 'SPREAD' ? spreadTemplateItems : pageTemplateItems"
          item-title="title"
          item-value="value"
          :label="spread.layoutMode === 'SPREAD' ? 'Шаблон разворота' : 'Левая страница'"
          density="compact"
          variant="outlined"
          hide-details
          class="default-spreads-tab__template"
        />

        <v-select
          v-if="spread.layoutMode === 'SPLIT_PAGES'"
          v-model="spread.rightMagazinePageId"
          :items="pageTemplateItems"
          item-title="title"
          item-value="value"
          label="Правая страница"
          density="compact"
          variant="outlined"
          hide-details
          class="default-spreads-tab__template"
        />

        <v-btn
          icon="mdi-content-copy"
          size="small"
          variant="text"
          aria-label="Дублировать в другой тип"
          @click="openDuplicateToType(index)"
        />

        <v-btn
          icon="mdi-delete-outline"
          size="small"
          variant="text"
          color="error"
          :disabled="spreads.length <= MIN_JOURNAL_SPREADS"
          aria-label="Удалить"
          @click="removeSpread(index)"
        />
      </div>
    </div>

    <MagazineTypePickerDialog
      v-model="duplicateDialog.open"
      :exclude-id="props.magazineTypeId"
      title="Дублировать разворот в другой тип"
      :loading="duplicateDialog.submitting"
      @confirm="confirmDuplicateToType"
    />

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { MIN_JOURNAL_SPREADS } from '@/features/order-builder/constants/journal.constants'
import { pickDefaultSpreadTemplate, groupTemplatesByPageType } from '@/features/order-builder/utils/journal-structure.util'
import {
  adminDefaultSpreadsApi,
  type DefaultSpreadItemPayload,
} from '@/shared/api/admin/default-spreads.api'
import {
  adminMagazinePagesApi,
  PAGE_TYPE_LABELS,
  type AdminMagazinePage,
} from '@/shared/api/admin/magazine-pages.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import MagazineTypePickerDialog from './MagazineTypePickerDialog.vue'

const props = defineProps<{
  magazineTypeId: string
}>()

interface EditableSpread extends DefaultSpreadItemPayload {
  key: string
  rightMagazinePageId?: string
}

const loading = ref(false)
const saving = ref(false)
const pages = ref<AdminMagazinePage[]>([])
const spreads = ref<EditableSpread[]>([])
const draggingKey = ref<string | null>(null)

const layoutModeItems = [
  { value: 'SPREAD' as const, label: 'Целый разворот' },
  { value: 'SPLIT_PAGES' as const, label: 'Две страницы' },
]

const spreadTemplateItems = computed(() =>
  pages.value
    .filter((page) => page.pageType === 'SPREAD')
    .map((page) => ({
      value: page.id,
      title: `${page.name} (${PAGE_TYPE_LABELS[page.pageType]})`,
    })),
)

const pageTemplateItems = computed(() =>
  pages.value
    .filter((page) => page.pageType === 'PAGE')
    .map((page) => ({
      value: page.id,
      title: `${page.name} (${PAGE_TYPE_LABELS[page.pageType]})`,
    })),
)

function createKey(): string {
  return `spread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toEditableSpread(item: DefaultSpreadItemPayload): EditableSpread {
  return {
    key: createKey(),
    layoutMode: item.layoutMode,
    magazinePageId: item.magazinePageId,
    rightMagazinePageId: item.rightMagazinePageId,
  }
}

function buildDefaultSpreads(): EditableSpread[] {
  const catalog = groupTemplatesByPageType(
    pages.value.map((page) => ({
      ...page,
      canvasData: page.canvasData,
    })),
  )
  const spreadDefault = pickDefaultSpreadTemplate(catalog)

  if (!spreadDefault) {
    return []
  }

  return Array.from({ length: MIN_JOURNAL_SPREADS }, () =>
    toEditableSpread({
      layoutMode: spreadDefault.layoutMode,
      magazinePageId: spreadDefault.magazinePageId,
      rightMagazinePageId: spreadDefault.rightMagazinePageId ?? undefined,
    }),
  )
}

async function load(): Promise<void> {
  loading.value = true

  try {
    pages.value = await adminMagazinePagesApi.list(props.magazineTypeId)
    const saved = await adminDefaultSpreadsApi.list(props.magazineTypeId)

    spreads.value = saved.map((item) =>
      toEditableSpread({
        layoutMode: item.layoutMode,
        magazinePageId: item.magazinePageId,
        rightMagazinePageId: item.rightMagazinePageId ?? undefined,
      }),
    )
  } finally {
    loading.value = false
  }
}

function initializeDefaults(): void {
  spreads.value = buildDefaultSpreads()
}

function addSpread(): void {
  const last = spreads.value.at(-1)
  const fallback = buildDefaultSpreads()[0]

  if (last) {
    spreads.value.push(toEditableSpread(last))
    return
  }

  if (fallback) {
    spreads.value.push(fallback)
  }
}

function removeSpread(index: number): void {
  if (spreads.value.length <= MIN_JOURNAL_SPREADS) {
    return
  }

  spreads.value.splice(index, 1)
}

function onDragStart(key: string): void {
  draggingKey.value = key
}

function onDrop(targetKey: string): void {
  const sourceKey = draggingKey.value
  draggingKey.value = null

  if (!sourceKey || sourceKey === targetKey) {
    return
  }

  const fromIndex = spreads.value.findIndex((item) => item.key === sourceKey)
  const toIndex = spreads.value.findIndex((item) => item.key === targetKey)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const next = [...spreads.value]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  spreads.value = next
}

async function save(): Promise<void> {
  if (spreads.value.length < MIN_JOURNAL_SPREADS) {
    return
  }

  saving.value = true

  try {
    const payload = {
      spreads: spreads.value.map((spread) => ({
        layoutMode: spread.layoutMode,
        magazinePageId: spread.magazinePageId,
        rightMagazinePageId:
          spread.layoutMode === 'SPLIT_PAGES' ? spread.rightMagazinePageId : undefined,
      })),
    }

    const saved = await adminDefaultSpreadsApi.replace(props.magazineTypeId, payload)
    spreads.value = saved.map((item) =>
      toEditableSpread({
        layoutMode: item.layoutMode,
        magazinePageId: item.magazinePageId,
        rightMagazinePageId: item.rightMagazinePageId ?? undefined,
      }),
    )
  } finally {
    saving.value = false
  }
}

const duplicateDialog = reactive({ open: false, index: null as number | null, submitting: false })
const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function openDuplicateToType(index: number): void {
  duplicateDialog.index = index
  duplicateDialog.open = true
}

async function confirmDuplicateToType(targetTypeId: string): Promise<void> {
  if (duplicateDialog.index === null) {
    return
  }

  const spread = spreads.value[duplicateDialog.index]
  if (!spread) {
    return
  }

  duplicateDialog.submitting = true
  try {
    await adminDefaultSpreadsApi.duplicateToType(props.magazineTypeId, {
      layoutMode: spread.layoutMode,
      magazinePageId: spread.magazinePageId,
      rightMagazinePageId:
        spread.layoutMode === 'SPLIT_PAGES' ? spread.rightMagazinePageId : undefined,
      targetMagazineTypeId: targetTypeId,
    })
    duplicateDialog.open = false
    notify('Разворот продублирован в другой тип')
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось продублировать разворот'), 'error')
  } finally {
    duplicateDialog.submitting = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped lang="scss">
.default-spreads-tab__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-4;
  margin-bottom: $spacing-6;
}

.default-spreads-tab__header-actions {
  display: flex;
  gap: $spacing-2;
  flex-shrink: 0;
}

.default-spreads-tab__title {
  margin: 0 0 $spacing-2;
  font-size: $font-size-h4;
}

.default-spreads-tab__subtitle {
  margin: 0;
  color: $text-secondary;
  max-width: 640px;
}

.default-spreads-tab__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.default-spreads-tab__item {
  display: grid;
  grid-template-columns: auto auto 160px minmax(180px, 1fr) minmax(180px, 1fr) auto auto;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;

  &--dragging {
    opacity: 0.55;
  }
}

.default-spreads-tab__drag {
  color: $text-muted;
  cursor: grab;
}

.default-spreads-tab__index {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: $bg-muted;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-caption;
  color: $text-secondary;
}

@media (max-width: 960px) {
  .default-spreads-tab__item {
    grid-template-columns: auto 1fr;
  }

  .default-spreads-tab__layout,
  .default-spreads-tab__template {
    grid-column: 1 / -1;
  }
}
</style>
