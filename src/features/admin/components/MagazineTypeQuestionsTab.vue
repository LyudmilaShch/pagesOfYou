<template>
  <div class="magazine-questions-tab">
    <div class="magazine-questions-tab__header">
      <div>
        <h2 class="magazine-questions-tab__title">Вопросы анкеты</h2>
        <p class="magazine-questions-tab__subtitle">
          Все вопросы этого типа журнала — единым списком, без привязки к конкретной странице.
          Ответы пользователя автоматически подставляются в объекты шаблона (на любой странице
          типа журнала), привязанные к вопросу по его key (в редакторе, в поле «Вопрос анкеты»).
        </p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate()">
        Добавить вопрос
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-alert v-if="!loading && questions.length === 0" type="info" variant="tonal" density="comfortable" class="mb-4">
      Вопросов пока нет.
    </v-alert>

    <div v-else-if="!loading" class="magazine-questions-tab__list">
      <div
        v-for="(question, index) in questions"
        :key="question.id"
        class="magazine-questions-tab__item"
        :class="{
          'magazine-questions-tab__item--dragging': draggingId === question.id,
          'magazine-questions-tab__item--drag-over': dragOverId === question.id && draggingId !== question.id,
        }"
        :data-question-id="question.id"
        draggable="true"
        @dragstart="onDragStart(question.id)"
        @dragover.prevent="dragOverId = question.id"
        @drop="onDrop(question.id)"
        @dragend="draggingId = null"
      >
        <div
          class="magazine-questions-tab__drag"
          aria-hidden="true"
          @pointerdown="handleDragHandlePointerDown($event, question.id)"
        >
          <v-icon size="18">mdi-drag-vertical</v-icon>
        </div>

        <div class="magazine-questions-tab__meta">
          <div class="magazine-questions-tab__label-row">
            <span class="magazine-questions-tab__label">{{ question.label }}</span>
            <v-chip size="x-small" variant="tonal">{{ QUESTION_TYPE_LABELS[question.type] }}</v-chip>
            <v-icon v-if="question.isRequired" size="14" color="error" title="Обязательный">mdi-asterisk</v-icon>
          </div>
          <span class="magazine-questions-tab__key">key: {{ question.key }}</span>
        </div>

        <span class="magazine-questions-tab__order">{{ index + 1 }}</span>

        <div class="magazine-questions-tab__actions">
          <v-btn
            icon="mdi-pencil-outline"
            size="small"
            variant="text"
            aria-label="Изменить"
            @click="openEdit(question)"
          />
          <v-btn
            icon="mdi-delete-outline"
            size="small"
            variant="text"
            color="error"
            aria-label="Удалить"
            @click="openDelete(question)"
          />
        </div>
      </div>
    </div>

    <v-dialog v-model="formDialog.open" max-width="480">
      <v-card>
        <v-card-title>{{ formDialog.editId ? 'Редактировать вопрос' : 'Новый вопрос' }}</v-card-title>
        <v-divider />
        <v-card-text>
          <div class="magazine-questions-tab__form">
            <v-text-field v-model="form.label" label="Текст вопроса *" variant="outlined" hide-details="auto" />
            <v-text-field
              v-model="form.key"
              label="key *"
              hint="Латиница, цифры, _ и - (например meeting_place). Нельзя изменить, если уже привязан к элементу шаблона."
              persistent-hint
              variant="outlined"
            />
            <v-select
              v-model="form.type"
              :items="questionTypeItems"
              item-title="label"
              item-value="value"
              label="Тип вопроса"
              variant="outlined"
              hide-details="auto"
            />
            <v-text-field v-model="form.placeholder" label="Плейсхолдер" variant="outlined" hide-details="auto" />
            <v-textarea v-model="form.helpText" label="Подсказка" variant="outlined" rows="2" hide-details="auto" />
            <v-switch v-model="form.isRequired" label="Обязательный вопрос" color="primary" hide-details />

            <div v-if="form.type === 'SELECT'" class="magazine-questions-tab__options">
              <div class="magazine-questions-tab__options-header">
                <span>Варианты выбора</span>
                <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="addOption">Добавить</v-btn>
              </div>
              <div v-for="(option, index) in form.options" :key="index" class="magazine-questions-tab__option-row">
                <v-text-field v-model="option.label" label="Название" variant="outlined" density="compact" hide-details />
                <v-text-field v-model="option.value" label="Значение" variant="outlined" density="compact" hide-details />
                <v-btn icon="mdi-close" size="small" variant="text" @click="removeOption(index)" />
              </div>
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="formDialog.open = false">Отмена</v-btn>
          <v-btn color="primary" :loading="formDialog.submitting" @click="submitForm">
            {{ formDialog.editId ? 'Сохранить' : 'Создать' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card>
        <v-card-title>Удалить вопрос?</v-card-title>
        <v-card-text>Вопрос «{{ deleteDialog.label }}» будет удалён.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog.open = false">Отмена</v-btn>
          <v-btn color="error" :loading="deleteDialog.loading" @click="confirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import {
  adminQuestionsApi,
  QUESTION_TYPE_LABELS,
  type AdminQuestion,
  type QuestionOptionPayload,
  type QuestionType,
} from '@/shared/api/admin/questions.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'

const props = defineProps<{
  magazineTypeId: string
}>()

const questions = ref<AdminQuestion[]>([])
const loading = ref(false)
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)

const questionTypeItems = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({
  value: value as QuestionType,
  label,
}))

const formDialog = reactive({ open: false, editId: null as string | null, submitting: false })
const form = reactive({
  label: '',
  key: '',
  type: 'TEXT' as QuestionType,
  placeholder: '',
  helpText: '',
  isRequired: false,
  options: [] as QuestionOptionPayload[],
})
const deleteDialog = reactive({ open: false, id: null as string | null, label: '', loading: false })
const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

async function loadAll(): Promise<void> {
  loading.value = true
  try {
    questions.value = await adminQuestionsApi.list(props.magazineTypeId)
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  formDialog.editId = null
  form.label = ''
  form.key = ''
  form.type = 'TEXT'
  form.placeholder = ''
  form.helpText = ''
  form.isRequired = false
  form.options = []
  formDialog.open = true
}

function openEdit(question: AdminQuestion): void {
  formDialog.editId = question.id
  form.label = question.label
  form.key = question.key
  form.type = question.type
  form.placeholder = question.placeholder ?? ''
  form.helpText = question.helpText ?? ''
  form.isRequired = question.isRequired
  form.options = question.options.map((option) => ({
    label: option.label,
    value: option.value,
    sortOrder: option.sortOrder,
  }))
  formDialog.open = true
}

function addOption(): void {
  form.options.push({ label: '', value: '' })
}

function removeOption(index: number): void {
  form.options.splice(index, 1)
}

function openDelete(question: AdminQuestion): void {
  deleteDialog.id = question.id
  deleteDialog.label = question.label
  deleteDialog.open = true
}

async function submitForm(): Promise<void> {
  if (!form.label.trim() || !form.key.trim()) {
    return
  }

  formDialog.submitting = true
  try {
    const payload = {
      key: form.key.trim(),
      type: form.type,
      label: form.label.trim(),
      placeholder: form.placeholder.trim() || undefined,
      helpText: form.helpText.trim() || undefined,
      isRequired: form.isRequired,
      options: form.type === 'SELECT' ? form.options : undefined,
    }

    if (formDialog.editId) {
      await adminQuestionsApi.update(props.magazineTypeId, formDialog.editId, payload)
    } else {
      await adminQuestionsApi.create(props.magazineTypeId, payload)
    }

    formDialog.open = false
    await loadAll()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось сохранить вопрос'), 'error')
  } finally {
    formDialog.submitting = false
  }
}

async function confirmDelete(): Promise<void> {
  if (!deleteDialog.id) {
    return
  }

  deleteDialog.loading = true
  try {
    await adminQuestionsApi.remove(props.magazineTypeId, deleteDialog.id)
    deleteDialog.open = false
    await loadAll()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось удалить вопрос'), 'error')
  } finally {
    deleteDialog.loading = false
  }
}

function onDragStart(questionId: string): void {
  draggingId.value = questionId
}

async function onDrop(targetId: string): Promise<void> {
  const sourceId = draggingId.value
  if (!sourceId || sourceId === targetId) {
    return
  }

  const reordered = [...questions.value]
  const fromIndex = reordered.findIndex((question) => question.id === sourceId)
  const toIndex = reordered.findIndex((question) => question.id === targetId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  const sortOrderById = new Map(reordered.map((question, index) => [question.id, index]))
  questions.value = reordered.map((question) => ({ ...question, sortOrder: sortOrderById.get(question.id)! }))

  await adminQuestionsApi.reorder(props.magazineTypeId, {
    items: [...sortOrderById.entries()].map(([id, sortOrder]) => ({ id, sortOrder })),
  })
}

// Native HTML5 drag-and-drop (draggable/@dragstart/@dragover/@drop above) only fires from a
// mouse — most mobile browsers never start a native drag from a touch gesture at all. This is a
// parallel, Pointer Events-based path for touch/pen input on the drag handle — mirrors
// SpreadReorderDialog.vue's own touch-compatible drag.
function findRowIdAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  const row = el ? (el.closest('[data-question-id]') as HTMLElement | null) : null
  return row?.dataset.questionId ?? null
}

function handlePointerDragMove(event: PointerEvent): void {
  const targetId = findRowIdAt(event.clientX, event.clientY)
  dragOverId.value = targetId && targetId !== draggingId.value ? targetId : null
}

function stopPointerDragTracking(): void {
  window.removeEventListener('pointermove', handlePointerDragMove)
  window.removeEventListener('pointerup', handlePointerDragEnd)
  window.removeEventListener('pointercancel', handlePointerDragCancel)
}

function handlePointerDragEnd(event: PointerEvent): void {
  stopPointerDragTracking()

  const targetId = findRowIdAt(event.clientX, event.clientY)
  if (targetId) {
    void onDrop(targetId)
  }
  draggingId.value = null
  dragOverId.value = null
}

function handlePointerDragCancel(): void {
  stopPointerDragTracking()
  draggingId.value = null
  dragOverId.value = null
}

function handleDragHandlePointerDown(event: PointerEvent, questionId: string): void {
  if (event.pointerType === 'mouse') {
    return
  }

  event.preventDefault()
  onDragStart(questionId)

  window.addEventListener('pointermove', handlePointerDragMove)
  window.addEventListener('pointerup', handlePointerDragEnd)
  window.addEventListener('pointercancel', handlePointerDragCancel)
}

onMounted(() => {
  void loadAll()
})

onBeforeUnmount(() => {
  stopPointerDragTracking()
})
</script>

<style scoped lang="scss">
.magazine-questions-tab__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-4;
  margin-bottom: $spacing-6;
}

.magazine-questions-tab__title {
  margin: 0 0 $spacing-1;
  font-family: $font-family-display;
  font-size: $font-size-h4;
}

.magazine-questions-tab__subtitle {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  max-width: 640px;
}

.magazine-questions-tab__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.magazine-questions-tab__item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  cursor: grab;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;

  &--dragging {
    opacity: 0.55;
  }

  &--drag-over {
    border-color: $accent;
    box-shadow: 0 0 0 2px $state-hover-bg;
  }
}

.magazine-questions-tab__drag {
  color: $text-muted;
  // Without this, a touch drag starting here is first interpreted as an attempt to scroll the
  // page, fighting the pointer-based reorder drag (see handleDragHandlePointerDown).
  touch-action: none;
}

.magazine-questions-tab__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.magazine-questions-tab__label-row {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.magazine-questions-tab__label {
  font-weight: $font-weight-medium;
}

.magazine-questions-tab__key {
  font-size: $font-size-caption;
  color: $text-muted;
  font-family: monospace;
}

.magazine-questions-tab__order {
  font-size: $font-size-caption;
  color: $text-secondary;
  min-width: 24px;
  text-align: center;
}

.magazine-questions-tab__actions {
  display: flex;
  gap: $spacing-1;
}

.magazine-questions-tab__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-top: $spacing-2;
}

.magazine-questions-tab__options {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
}

.magazine-questions-tab__options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-body-sm;
  color: $text-secondary;
}

.magazine-questions-tab__option-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: $spacing-2;
  align-items: center;
}
</style>
