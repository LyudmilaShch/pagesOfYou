<template>
  <div>
    <v-text-field
      :model-value="displayText"
      :label="label"
      :hint="hint"
      persistent-hint
      variant="outlined"
      density="compact"
      readonly
      hide-details="auto"
      append-inner-icon="mdi-chevron-down"
      @click="open = true"
    />

    <EditorQuestionPickerDialog
      v-model:open="open"
      :multiple="multiple"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { editorQuestions } from '../services/editor-questions'
import EditorQuestionPickerDialog from './EditorQuestionPickerDialog.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    multiple?: boolean
    label?: string
    hint?: string
  }>(),
  {
    multiple: false,
    label: 'Вопрос анкеты',
    hint: undefined,
  },
)

defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)

const displayText = computed(() => {
  const labels = props.modelValue
    .map((key) => editorQuestions.value.find((question) => question.key === key)?.label)
    .filter((label): label is string => Boolean(label))
  return labels.join(', ')
})
</script>
