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
            <v-chip v-if="item.element.contentSource === 'journal'" size="x-small" variant="tonal" color="primary">
              по всему журналу
            </v-chip>
            <v-chip size="x-small" variant="outlined">
              {{ item.element.questionKeys.length }} {{ pluralQuestions(item.element.questionKeys.length) }}
            </v-chip>
            <v-chip v-if="item.parts.length > 1" size="x-small" variant="outlined" prepend-icon="mdi-link-variant">
              {{ item.parts.length }} {{ pluralParts(item.parts.length) }}
              <template v-if="item.element.chainMode === 'phrases'"> · отдельные фразы</template>
            </v-chip>
            <v-chip
              v-for="(part, index) in item.parts"
              :key="part.id"
              size="x-small"
              variant="outlined"
            >
              <template v-if="item.parts.length > 1">{{ index + 1 }}: </template>{{ lengthSummary(part.lengthConstraint) }}
            </v-chip>
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

          <p v-if="isJournalSource" class="mt-ai-texts-tab__parts-hint">
            Текст пишется после заполнения анкеты — по всем ответам и текстам журнала. Выбранные
            ниже вопросы задаются последним шагом анкеты как пожелания.
          </p>

          <v-select
            v-model="form.questionKeys"
            :items="questionItems"
            item-title="label"
            item-value="key"
            :label="isJournalSource ?'Дополнительные вопросы (необязательно)' : 'Вопросы, используемые в промпте'"
            variant="outlined"
            multiple
            chips
            closable-chips
            hide-details="auto"
          />

          <p v-if="form.parts.length > 1" class="mt-ai-texts-tab__parts-hint">
            Текст разбит на {{ form.parts.length }} {{ pluralParts(form.parts.length) }} — промпт и
            вопросы общие, длина задаётся для каждой части. Порядок и расположение частей меняются в
            редакторе разворота.
          </p>

          <div v-for="(part, index) in form.parts" :key="part.id" class="mt-ai-texts-tab__length">
            <p class="mt-ai-texts-tab__length-title">
              {{ form.parts.length > 1 ? `Часть ${index + 1} · ${part.name}` : 'Длина текста' }}
            </p>
            <v-text-field
              v-if="form.parts.length > 1"
              v-model="part.partHint"
              :label="isPhrases ? 'О чём эта фраза (необязательно)' : 'О чём эта часть (необязательно)'"
              :placeholder="isPhrases ? 'Например: увлечение, мечта, черта характера' : 'Например: знакомство, пожелание на будущее'"
              variant="outlined"
              density="compact"
              hide-details
            />
            <v-btn-toggle v-model="part.lengthUnit" color="primary" density="compact" mandatory>
              <v-btn value="characters" size="small">Символы</v-btn>
              <v-btn value="words" size="small">Слова</v-btn>
            </v-btn-toggle>
            <div class="mt-ai-texts-tab__bounds">
              <v-text-field
                v-model.number="part.lengthMin"
                label="Минимум"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="part.lengthMax"
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
import { getAiTextSiblingParts } from '@/modules/editor/utils/ai-text-chain.util'
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

/** One generated text — a standalone block, or every part of a chain (see ai-text-chain.util.ts),
 * whose shared prompt/questions are edited once and written to all parts. */
interface AiTextItem {
  pageId: string
  pageName: string
  pageType: PageType
  /** The first part — the one shown in the list (prompt/questions are mirrored across parts). */
  element: AiTextPlaceholder
  parts: AiTextPlaceholder[]
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

function pluralParts(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'частей'
  if (mod10 === 1) return 'часть'
  if (mod10 >= 2 && mod10 <= 4) return 'части'
  return 'частей'
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
    const seenChainIds = new Set<string>()
    walkTree(page.canvasData.elements, (node) => {
      if (!isAiTextElement(node)) {
        return
      }
      if (node.chainId) {
        if (seenChainIds.has(node.chainId)) {
          return
        }
        seenChainIds.add(node.chainId)
      }
      const parts = getAiTextSiblingParts(page.canvasData.elements, node)
      collected.push({ pageId: page.id, pageName: page.name, pageType: page.pageType, element: parts[0], parts })
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
interface PartLengthForm {
  id: string
  name: string
  partHint: string
  lengthUnit: LengthConstraintUnit
  lengthMin: number
  lengthMax: number
}

const form = reactive({
  prompt: '',
  questionKeys: [] as string[],
  parts: [] as PartLengthForm[],
})

// Chain mode and content source are fixed when the element is created (the editor's
// "Фраза обложки" vs a regular AI text) — shown here read-only, never written back.
const isJournalSource = computed(() => editDialog.item?.element.contentSource === 'journal')
const isPhrases = computed(() => editDialog.item?.element.chainMode === 'phrases')

function openEdit(item: AiTextItem): void {
  editDialog.item = item
  form.prompt = item.element.prompt
  form.questionKeys = [...item.element.questionKeys]
  form.parts = item.parts.map((part) => ({
    id: part.id,
    name: part.name,
    partHint: part.partHint,
    lengthUnit: part.lengthConstraint.unit,
    lengthMin: part.lengthConstraint.min ?? 0,
    lengthMax: part.lengthConstraint.max ?? 0,
  }))
  editDialog.open = true
}

async function submitEdit(): Promise<void> {
  const item = editDialog.item
  if (!item) {
    return
  }

  const page = pages.value.find((candidate) => candidate.id === item.pageId)
  const locations = page
    ? form.parts.map((part) => ({ part, location: locateNode(page.canvasData.elements, part.id) }))
    : []
  if (!page || locations.some(({ location }) => !location)) {
    notify('Элемент больше не существует — обновите список', 'error')
    return
  }

  for (const { part, location } of locations) {
    location!.siblings[location!.index] = {
      ...(location!.node as AiTextPlaceholder),
      prompt: form.prompt,
      questionKeys: [...form.questionKeys],
      partHint: part.partHint.trim(),
      lengthConstraint: {
        unit: part.lengthUnit,
        min: part.lengthMin || null,
        max: part.lengthMax || null,
      },
    }
  }

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

.mt-ai-texts-tab__parts-hint {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
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
