<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="$emit('update:open', $event)">
    <v-card>
      <v-card-title>{{ showCreateForm ? 'Новый вопрос' : 'Вопрос анкеты' }}</v-card-title>
      <v-divider />

      <v-card-text class="editor-question-picker">
        <template v-if="!showCreateForm">
          <button
            v-if="!multiple && pendingKeys.length > 0"
            type="button"
            class="editor-question-picker__clear"
            @click="selectNone"
          >
            <v-icon size="16">mdi-close-circle-outline</v-icon>
            Не выбрано
          </button>

          <p v-if="editorQuestions.length === 0" class="editor-question-picker__empty">
            Вопросов пока нет — добавьте первый.
          </p>

          <div v-else class="editor-question-picker__list">
            <div
              v-for="question in editorQuestions"
              :key="question.key"
              class="editor-question-picker__item"
              :class="{ 'editor-question-picker__item--active': pendingKeys.includes(question.key) }"
              @click="multiple ? toggleKey(question.key) : selectSingle(question.key)"
            >
              <v-checkbox
                v-if="multiple"
                :model-value="pendingKeys.includes(question.key)"
                density="compact"
                hide-details
                readonly
              />
              <span class="editor-question-picker__item-text">
                <span class="editor-question-picker__item-label">{{ question.label }}</span>
                <span class="editor-question-picker__item-key">key: {{ question.key }}</span>
              </span>
            </div>
          </div>

          <v-btn
            v-if="createEditorQuestion"
            variant="outlined"
            block
            prepend-icon="mdi-plus"
            class="editor-question-picker__add-btn"
            @click="openCreateForm"
          >
            Добавить вопрос
          </v-btn>
        </template>

        <div v-else class="editor-question-picker__form">
          <v-alert v-if="createError" type="error" variant="tonal" density="compact">{{ createError }}</v-alert>

          <v-text-field
            v-model="createForm.label"
            label="Текст вопроса *"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-text-field
            v-model="createForm.key"
            label="key *"
            hint="Латиница, цифры, _ и - (например meeting_place)"
            persistent-hint
            variant="outlined"
            density="compact"
          />
          <v-select
            v-model="createForm.type"
            :items="questionTypeItems"
            item-title="label"
            item-value="value"
            label="Тип вопроса"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-text-field
            v-model="createForm.placeholder"
            label="Плейсхолдер"
            variant="outlined"
            density="compact"
            hide-details="auto"
          />
          <v-textarea
            v-model="createForm.helpText"
            label="Подсказка"
            variant="outlined"
            density="compact"
            rows="2"
            hide-details="auto"
          />
          <EditorSwitch v-model="createForm.isRequired" label="Обязательный вопрос" />

          <div v-if="createForm.type === 'SELECT'" class="editor-question-picker__options">
            <div class="editor-question-picker__options-header">
              <span>Варианты выбора</span>
              <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="addOption">Добавить</v-btn>
            </div>
            <div v-for="(option, index) in createForm.options" :key="index" class="editor-question-picker__option-row">
              <v-text-field v-model="option.label" label="Название" variant="outlined" density="compact" hide-details />
              <v-text-field v-model="option.value" label="Значение" variant="outlined" density="compact" hide-details />
              <v-btn icon="mdi-close" size="small" variant="text" @click="removeOption(index)" />
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <template v-if="showCreateForm">
          <v-btn variant="text" @click="closeCreateForm">Назад</v-btn>
          <v-spacer />
          <v-btn color="primary" :loading="creating" @click="submitCreate">Создать</v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" @click="$emit('update:open', false)">Отмена</v-btn>
          <v-spacer />
          <v-btn v-if="multiple" color="primary" @click="confirm">Готово</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

import {
  createEditorQuestion,
  editorQuestions,
  type CreateEditorQuestionPayload,
} from '../services/editor-questions'
import { QUESTION_TYPE_LABELS, type QuestionOptionPayload, type QuestionType } from '@/shared/api/admin/questions.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'
import EditorSwitch from './EditorSwitch.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    modelValue: string[]
    multiple?: boolean
  }>(),
  { multiple: false },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:modelValue': [value: string[]]
}>()

const questionTypeItems = Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => ({
  value: value as QuestionType,
  label,
}))

const pendingKeys = ref<string[]>([...props.modelValue])
const showCreateForm = ref(false)
const creating = ref(false)
const createError = ref('')

function emptyCreateForm(): {
  label: string
  key: string
  type: QuestionType
  placeholder: string
  helpText: string
  isRequired: boolean
  options: QuestionOptionPayload[]
} {
  return { label: '', key: '', type: 'TEXT', placeholder: '', helpText: '', isRequired: false, options: [] }
}

const createForm = reactive(emptyCreateForm())

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return
    }
    pendingKeys.value = [...props.modelValue]
    showCreateForm.value = false
    createError.value = ''
    Object.assign(createForm, emptyCreateForm())
  },
)

function toggleKey(key: string): void {
  pendingKeys.value = pendingKeys.value.includes(key)
    ? pendingKeys.value.filter((existing) => existing !== key)
    : [...pendingKeys.value, key]
}

function confirm(): void {
  emit('update:modelValue', pendingKeys.value)
  emit('update:open', false)
}

function selectSingle(key: string): void {
  pendingKeys.value = [key]
  confirm()
}

function selectNone(): void {
  pendingKeys.value = []
  confirm()
}

function openCreateForm(): void {
  Object.assign(createForm, emptyCreateForm())
  createError.value = ''
  showCreateForm.value = true
}

function closeCreateForm(): void {
  showCreateForm.value = false
}

function addOption(): void {
  createForm.options.push({ label: '', value: '' })
}

function removeOption(index: number): void {
  createForm.options.splice(index, 1)
}

async function submitCreate(): Promise<void> {
  const label = createForm.label.trim()
  const key = createForm.key.trim()
  if (!createEditorQuestion.value || !label || !key) {
    return
  }

  creating.value = true
  createError.value = ''
  try {
    const payload: CreateEditorQuestionPayload = {
      key,
      label,
      type: createForm.type,
      placeholder: createForm.placeholder.trim() || undefined,
      helpText: createForm.helpText.trim() || undefined,
      isRequired: createForm.isRequired,
      options: createForm.type === 'SELECT' ? createForm.options : undefined,
    }
    const created = await createEditorQuestion.value(payload)

    if (props.multiple) {
      if (!pendingKeys.value.includes(created.key)) {
        pendingKeys.value = [...pendingKeys.value, created.key]
      }
      showCreateForm.value = false
    } else {
      pendingKeys.value = [created.key]
      confirm()
    }
  } catch (err) {
    createError.value = extractApiErrorMessage(err, 'Не удалось создать вопрос')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped lang="scss">
.editor-question-picker {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-question-picker__clear {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  cursor: pointer;

  &:hover {
    color: $text-primary;
  }
}

.editor-question-picker__empty {
  margin: 0;
  padding: $spacing-4;
  text-align: center;
  color: $text-muted;
  font-size: $font-size-body-sm;
  border: 1px dashed $border-light;
  border-radius: $radius-md;
}

.editor-question-picker__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  max-height: 320px;
  overflow-y: auto;
}

.editor-question-picker__item {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-2 $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  cursor: pointer;

  &:hover {
    background: $bg-elevated;
  }

  &--active {
    border-color: $accent;
    background: $bg-elevated;
  }
}

.editor-question-picker__item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.editor-question-picker__item-label {
  font-weight: $font-weight-medium;
}

.editor-question-picker__item-key {
  font-size: $font-size-caption;
  color: $text-muted;
  font-family: monospace;
}

.editor-question-picker__add-btn {
  margin-top: $spacing-1;
}

.editor-question-picker__form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-question-picker__options {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
}

.editor-question-picker__options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-body-sm;
  color: $text-secondary;
}

.editor-question-picker__option-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: $spacing-2;
  align-items: center;
}
</style>
