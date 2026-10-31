<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="handleDialogUpdate">
    <v-card>
      <v-card-title>Изменить текст</v-card-title>
      <v-card-subtitle>Текст сгенерирован по вашим ответам — здесь можно поправить его вручную</v-card-subtitle>
      <v-divider />

      <v-card-text>
        <v-textarea
          v-model="draft"
          variant="outlined"
          rows="6"
          auto-grow
          hide-details="auto"
          :counter="maxChars ?? undefined"
          :maxlength="maxChars ?? undefined"
        />

        <p v-if="isWordUnit && maxWords !== null" class="ai-text-edit__word-count" :class="{ 'ai-text-edit__word-count--over': wordCount > maxWords }">
          {{ wordCount }} из {{ maxWords }} слов
        </p>

        <p v-if="fit.issue" class="ai-text-edit__overflow">
          <v-icon size="16">mdi-alert-outline</v-icon>
          {{ AI_TEXT_FIT_ISSUE_LABELS[fit.issue] }} — сократите примерно на
          {{ fit.excessWords }} {{ pluralWords(fit.excessWords) }}
        </p>
        <p v-else-if="fit.exceedsBox" class="ai-text-edit__hint">
          Текст чуть длиннее, чем задумано в макете, но ни на что не наезжает — так можно оставить
        </p>

        <p v-if="minLimit !== null" class="ai-text-edit__hint">
          Рекомендуемый минимум — {{ minLimit }} {{ isWordUnit ? 'слов' : 'символов' }}
        </p>
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-btn variant="text" @click="emit('close')">Отмена</v-btn>
        <v-spacer />
        <v-btn color="primary" :loading="loading" :disabled="!canSave" @click="save">Сохранить</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { AiTextPlaceholder, LengthConstraint } from '@/modules/editor/models'
import {
  AI_TEXT_FIT_ISSUE_LABELS,
  analyzeAiTextFit,
  type AiTextFit,
  type AiTextFitContext,
} from '@/modules/editor/utils/ai-text-capacity.util'

const props = defineProps<{
  open: boolean
  initialText: string
  loading?: boolean
  lengthConstraint?: LengthConstraint | null
  /** The block being edited (materialized, absolute position — the customer's typography) — when
   * given, the draft is measured live against what's around it (`fitContext`), warning before a
   * too-long text runs into a photo/another text or off the page. */
  element?: AiTextPlaceholder | null
  fitContext?: AiTextFitContext | null
}>()

const emit = defineEmits<{
  close: []
  save: [text: string]
}>()

const draft = ref(props.initialText)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      draft.value = props.initialText
    }
  },
)

const isWordUnit = computed(() => props.lengthConstraint?.unit === 'words')
// Vuetify's own textarea `counter`/`maxlength` handle the character case (including hard-capping
// input) — words have no native equivalent, so those are tracked/enforced manually below instead.
const maxChars = computed(() => (isWordUnit.value ? null : props.lengthConstraint?.max ?? null))
const maxWords = computed(() => (isWordUnit.value ? props.lengthConstraint?.max ?? null : null))
const minLimit = computed(() => props.lengthConstraint?.min ?? null)

const wordCount = computed(() => {
  const trimmed = draft.value.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
})

// Doesn't block saving — the customer may still prefer to shorten it later; the review step
// re-checks before checkout.
const fit = computed<AiTextFit>(() =>
  props.open && props.element
    ? analyzeAiTextFit(props.element, draft.value, props.fitContext ?? null)
    : { exceedsBox: false, issue: null, excessWords: 0 },
)

function pluralWords(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'слов'
  if (mod10 === 1) return 'слово'
  if (mod10 >= 2 && mod10 <= 4) return 'слова'
  return 'слов'
}

const canSave = computed(() => {
  if (!draft.value.trim()) {
    return false
  }
  if (maxWords.value !== null && wordCount.value > maxWords.value) {
    return false
  }
  return true
})

function save(): void {
  const text = draft.value.trim()
  if (!canSave.value || !text) {
    return
  }
  emit('save', text)
}

function handleDialogUpdate(value: boolean): void {
  if (!value) {
    emit('close')
  }
}
</script>

<style scoped lang="scss">
.ai-text-edit__word-count {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-secondary;
  text-align: right;

  &--over {
    color: $accent-deep;
  }
}

.ai-text-edit__overflow {
  display: flex;
  align-items: flex-start;
  gap: $spacing-1;
  margin: $spacing-2 0 0;
  font-size: $font-size-caption;
  color: $accent-deep;
}

.ai-text-edit__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}
</style>
