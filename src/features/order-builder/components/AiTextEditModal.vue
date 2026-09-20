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

import type { LengthConstraint } from '@/modules/editor/models'

const props = defineProps<{
  open: boolean
  initialText: string
  loading?: boolean
  lengthConstraint?: LengthConstraint | null
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

.ai-text-edit__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}
</style>
