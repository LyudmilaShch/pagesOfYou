<template>
  <div class="question-list-field">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="question-list-field__row"
      :class="{ 'question-list-field__row--detailed': withDetails }"
    >
      <span class="question-list-field__number">{{ index + 1 }}</span>
      <div class="question-list-field__inputs">
        <v-text-field
          :ref="(el) => setInputRef(el, index)"
          :model-value="item.title"
          :placeholder="withDetails ? 'Заголовок' : index === 0 ? (placeholder ?? undefined) : undefined"
          variant="outlined"
          density="comfortable"
          :maxlength="maxLength ?? undefined"
          :counter="maxLength ?? undefined"
          :hide-details="maxLength ? 'auto' : true"
          persistent-counter
          :autofocus="autofocus && index === 0"
          @update:model-value="updateItem(index, { title: $event })"
          @keydown.enter.prevent="withDetails ? undefined : addItem(index + 1)"
        />
        <v-textarea
          v-if="withDetails"
          :model-value="item.text"
          placeholder="Описание"
          variant="outlined"
          density="comfortable"
          rows="2"
          auto-grow
          :maxlength="detailMaxLength ?? undefined"
          :counter="detailMaxLength ?? undefined"
          :hide-details="detailMaxLength ? 'auto' : true"
          persistent-counter
          @update:model-value="updateItem(index, { text: $event })"
        />
      </div>
      <v-btn
        v-if="items.length > 1"
        icon="mdi-close"
        variant="text"
        size="small"
        aria-label="Удалить пункт"
        @click="removeItem(index)"
      />
    </div>

    <div class="question-list-field__footer">
      <div class="question-list-field__actions">
        <v-btn
          v-if="!isFull"
          variant="text"
          size="small"
          prepend-icon="mdi-plus"
          @click="addItem(items.length)"
        >
          Ещё пункт
        </v-btn>
        <v-btn
          v-if="canSuggest && max !== null && filledCount < max"
          variant="text"
          size="small"
          prepend-icon="mdi-creation"
          :loading="suggesting"
          @click="emit('suggest')"
        >
          Предложить пункты
        </v-btn>
      </div>
      <span v-if="max" class="question-list-field__count">
        {{ filledCount }} из {{ max }}<template v-if="min > 0"> · минимум {{ min }}</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'

import { isListEntryFilled, type ListAnswerEntry } from '../../utils/list-answer.util'

/** A LIST question's answer: one input per item (plus a description input when the list's rows
 * have descriptions), added with "Ещё пункт" (or Enter) up to `max` — the number of rows the
 * journal's list(s) for this question have — and at least `min` items shown from the start (the
 * admin's minimum). Blank items are kept while the customer types (so they don't vanish under the
 * cursor); the backend drops them on save. */
const props = withDefaults(
  defineProps<{
    modelValue: ListAnswerEntry[]
    max: number | null
    min?: number
    /** The rows have description texts — each item gets a description input too. */
    withDetails?: boolean
    /** Per item — the template's limits for the title and the description text. */
    maxLength?: number | null
    detailMaxLength?: number | null
    placeholder?: string | null
    autofocus?: boolean
    /** "Предложить пункты" is on for this list (the admin's `list.suggestEnabled`). */
    canSuggest?: boolean
    /** An AI suggestion for this list is in flight (the parent owns the request). */
    suggesting?: boolean
  }>(),
  {
    min: 0,
    withDetails: false,
    maxLength: null,
    detailMaxLength: null,
    placeholder: null,
    autofocus: false,
    canSuggest: true,
    suggesting: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: ListAnswerEntry[]]
  /** "Предложить пункты" — the parent asks the AI and writes the items back via v-model. */
  suggest: []
}>()

const blankEntry = (): ListAnswerEntry => ({ title: '', text: '' })

const items = computed(() => {
  const shown = Math.max(1, props.min)
  return props.modelValue.length >= shown
    ? props.modelValue
    : [...props.modelValue, ...Array.from({ length: shown - props.modelValue.length }, blankEntry)]
})
const isFull = computed(() => props.max !== null && items.value.length >= props.max)
const filledCount = computed(() => props.modelValue.filter(isListEntryFilled).length)

const inputRefs: Array<{ focus: () => void } | null> = []

function setInputRef(el: unknown, index: number): void {
  inputRefs[index] = (el as { focus: () => void } | null) ?? null
}

function updateItem(index: number, patch: Partial<ListAnswerEntry>): void {
  const next = [...items.value]
  next[index] = { ...next[index], ...patch }
  emit('update:modelValue', next)
}

async function addItem(at: number): Promise<void> {
  if (isFull.value) {
    return
  }
  const next = [...items.value]
  next.splice(at, 0, blankEntry())
  emit('update:modelValue', next)
  await nextTick()
  inputRefs[at]?.focus()
}

function removeItem(index: number): void {
  emit('update:modelValue', items.value.filter((_, i) => i !== index))
}
</script>

<style scoped lang="scss">
.question-list-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.question-list-field__inputs {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $spacing-1;
  min-width: 0;
}

// A title + description item reads as one card: number and ✕ align with the title, not the middle.
.question-list-field__row--detailed {
  align-items: flex-start;

  .question-list-field__number {
    padding-top: 14px;
  }
}

.question-list-field__row {
  display: flex;
  align-items: center;
  gap: $spacing-2;
}

.question-list-field__number {
  flex-shrink: 0;
  width: 20px;
  text-align: right;
  color: $text-muted;
  font-variant-numeric: tabular-nums;
}

.question-list-field__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-2;
}

.question-list-field__actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-1;
}

.question-list-field__count {
  font-size: 12px;
  color: $text-muted;
}
</style>
