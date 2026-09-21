<template>
  <div class="mt-ai-texts-tab">
    <div class="mt-ai-texts-tab__header">
      <h2 class="mt-ai-texts-tab__title">AI-тексты</h2>
      <p class="mt-ai-texts-tab__subtitle">
        Все AI-текстовые элементы этого типа журнала — промпт, привязанные вопросы и длина текста
        можно настроить прямо здесь, без открытия редактора разворота (работает и с телефона).
      </p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-alert v-if="!loading && items.length === 0" type="info" variant="tonal" density="comfortable">
      На страницах этого типа журнала нет AI-текстовых элементов.
    </v-alert>

    <div v-else-if="!loading" class="mt-ai-texts-tab__list">
      <button
        v-for="item in items"
        :key="item.element.id"
        type="button"
        class="mt-ai-texts-tab__item"
        @click="openEdit(item)"
      >
        <div class="mt-ai-texts-tab__item-meta">
          <div class="mt-ai-texts-tab__item-label-row">
            <span class="mt-ai-texts-tab__item-label">{{ item.element.label || item.element.name }}</span>
            <v-chip size="x-small" variant="tonal">{{ PAGE_TYPE_LABELS[item.pageType] }} · {{ item.pageName }}</v-chip>
          </div>
          <p class="mt-ai-texts-tab__item-prompt">{{ item.element.prompt || 'Промпт не задан' }}</p>
          <div class="mt-ai-texts-tab__item-tags">
            <v-chip size="x-small" variant="outlined">
              {{ item.element.questionKeys.length }} {{ pluralQuestions(item.element.questionKeys.length) }}
            </v-chip>
            <v-chip size="x-small" variant="outlined">{{ lengthSummary(item.element.lengthConstraint) }}</v-chip>
          </div>
        </div>
        <v-icon size="18" color="grey">mdi-chevron-right</v-icon>
      </button>
    </div>

    <v-dialog v-model="editDialog.open" max-width="560">
      <v-card v-if="editDialog.item">
        <v-card-title>{{ editDialog.item.element.label || editDialog.item.element.name }}</v-card-title>
        <v-card-subtitle>
          {{ PAGE_TYPE_LABELS[editDialog.item.pageType] }} · {{ editDialog.item.pageName }}
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="mt-ai-texts-tab__form">
          <v-textarea
            v-model="form.prompt"
            label="Промпт"
            variant="outlined"
            rows="5"
            hint="Опишите, что должен написать AI. В промпт автоматически попадут ответы на выбранные ниже вопросы."
            persistent-hint
          />

          <v-select
            v-model="form.questionKeys"
            :items="questionItems"
            item-title="label"
            item-value="key"
            label="Вопросы, используемые в промпте"
            variant="outlined"
            multiple
            chips
            closable-chips
            hide-details="auto"
          />

          <div class="mt-ai-texts-tab__length">
            <p class="mt-ai-texts-tab__length-title">Длина текста</p>
            <v-btn-toggle v-model="form.lengthUnit" color="primary" density="compact" mandatory>
              <v-btn value="characters" size="small">Символы</v-btn>
              <v-btn value="words" size="small">Слова</v-btn>
            </v-btn-toggle>
            <div class="mt-ai-texts-tab__bounds">
              <v-text-field
                v-model.number="form.lengthMin"
                label="Минимум"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.lengthMax"
                label="Максимум"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog.open = false">Отмена</v-btn>
          <v-btn color="primary" :loading="editDialog.saving" @click="submitEdit">Сохранить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { isAiTextElement } from '@/modules/editor/models'
import type { AiTextPlaceholder, LengthConstraint, LengthConstraintUnit } from '@/modules/editor/models'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { locateNode, walkTree } from '@/modules/editor/utils/element-tree.util'
import {
  adminMagazinePagesApi,
  PAGE_TYPE_LABELS,
  type AdminMagazinePage,
  type PageType,
} from '@/shared/api/admin/magazine-pages.api'
import { adminQuestionsApi, type AdminQuestion } from '@/shared/api/admin/questions.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'

const props = defineProps<{
  magazineTypeId: string
}>()

interface AiTextItem {
  pageId: string
  pageName: string
  pageType: PageType
  element: AiTextPlaceholder
}

const pages = ref<AdminMagazinePage[]>([])
const questions = ref<AdminQuestion[]>([])
const items = ref<AiTextItem[]>([])
const loading = ref(false)

const questionItems = computed(() => questions.value.map((question) => ({ key: question.key, label: question.label })))

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

function pluralQuestions(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'вопросов'
  if (mod10 === 1) return 'вопрос'
  if (mod10 >= 2 && mod10 <= 4) return 'вопроса'
  return 'вопросов'
}

function lengthSummary(constraint: LengthConstraint): string {
  const unitLabel = constraint.unit === 'characters' ? 'симв.' : 'слов'
  if (constraint.min != null && constraint.max != null) {
    return `${constraint.min}–${constraint.max} ${unitLabel}`
  }
  if (constraint.max != null) {
    return `до ${constraint.max} ${unitLabel}`
  }
  if (constraint.min != null) {
    return `от ${constraint.min} ${unitLabel}`
  }
  return `без ограничений, ${unitLabel}`
}

// The list endpoint returns canvasData exactly as stored — normalizeCanvasData is only applied
// backend-side on WRITE, not on read (see admin-magazine-pages.service.ts) — so, like every other
// place in the app that touches canvas JSON (PhotoUploadPage.vue, JournalSpreadThumbnail.vue,
// etc.), this normalizes it client-side before relying on its shape.
function normalizePages(pageList: AdminMagazinePage[]): AdminMagazinePage[] {
  return pageList.map((page) => ({ ...page, canvasData: normalizeCanvasData(page.canvasData) }))
}

function collectAiTextItems(pageList: AdminMagazinePage[]): AiTextItem[] {
  const collected: AiTextItem[] = []
  for (const page of pageList) {
    walkTree(page.canvasData.elements, (node) => {
      if (isAiTextElement(node)) {
        collected.push({ pageId: page.id, pageName: page.name, pageType: page.pageType, element: node })
      }
    })
  }
  return collected
}

async function loadAll(): Promise<void> {
  loading.value = true
  try {
    const [pagesResult, questionsResult] = await Promise.all([
      adminMagazinePagesApi.list(props.magazineTypeId),
      adminQuestionsApi.list(props.magazineTypeId),
    ])
    pages.value = normalizePages(pagesResult)
    questions.value = questionsResult
    items.value = collectAiTextItems(pages.value)
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось загрузить AI-тексты'), 'error')
  } finally {
    loading.value = false
  }
}

const editDialog = reactive<{ open: boolean; item: AiTextItem | null; saving: boolean }>({
  open: false,
  item: null,
  saving: false,
})
const form = reactive({
  prompt: '',
  questionKeys: [] as string[],
  lengthUnit: 'characters' as LengthConstraintUnit,
  lengthMin: 0,
  lengthMax: 0,
})

function openEdit(item: AiTextItem): void {
  editDialog.item = item
  form.prompt = item.element.prompt
  form.questionKeys = [...item.element.questionKeys]
  form.lengthUnit = item.element.lengthConstraint.unit
  form.lengthMin = item.element.lengthConstraint.min ?? 0
  form.lengthMax = item.element.lengthConstraint.max ?? 0
  editDialog.open = true
}

async function submitEdit(): Promise<void> {
  const item = editDialog.item
  if (!item) {
    return
  }

  const page = pages.value.find((candidate) => candidate.id === item.pageId)
  const location = page ? locateNode(page.canvasData.elements, item.element.id) : null
  if (!page || !location) {
    notify('Элемент больше не существует — обновите список', 'error')
    return
  }

  const patchedElement: AiTextPlaceholder = {
    ...item.element,
    prompt: form.prompt,
    questionKeys: [...form.questionKeys],
    lengthConstraint: {
      unit: form.lengthUnit,
      min: form.lengthMin || null,
      max: form.lengthMax || null,
    },
  }
  location.siblings[location.index] = patchedElement

  editDialog.saving = true
  try {
    const updated = await adminMagazinePagesApi.update(props.magazineTypeId, page.id, {
      canvasData: page.canvasData,
    })

    const pageIndex = pages.value.findIndex((candidate) => candidate.id === page.id)
    if (pageIndex !== -1) {
      pages.value[pageIndex] = updated
    }
    items.value = collectAiTextItems(pages.value)

    editDialog.open = false
    notify('Сохранено')
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось сохранить'), 'error')
  } finally {
    editDialog.saving = false
  }
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped lang="scss">
.mt-ai-texts-tab__header {
  margin-bottom: $spacing-6;
}

.mt-ai-texts-tab__title {
  margin: 0 0 $spacing-1;
  font-family: $font-family-display;
  font-size: $font-size-h4;
}

.mt-ai-texts-tab__subtitle {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  max-width: 640px;
}

.mt-ai-texts-tab__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.mt-ai-texts-tab__item {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;

  &:hover {
    border-color: $accent;
    background: $accent-tint;
  }
}

.mt-ai-texts-tab__item-meta {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  min-width: 0;
  flex: 1;
}

.mt-ai-texts-tab__item-label-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.mt-ai-texts-tab__item-label {
  font-weight: $font-weight-medium;
}

.mt-ai-texts-tab__item-prompt {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mt-ai-texts-tab__item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-1;
}

.mt-ai-texts-tab__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-top: $spacing-2;
}

.mt-ai-texts-tab__length {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.mt-ai-texts-tab__length-title {
  margin: 0;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-secondary;
}

.mt-ai-texts-tab__bounds {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-2;
}
</style>
