<template>
  <div class="editor-ai-text-config-screen">
    <EditorTextField
      :model-value="aiTextElement?.prompt ?? ''"
      label="Промпт"
      multiline
      :rows="5"
      hint="Опишите, что должен написать AI. В промпт автоматически попадут ответы на выбранные ниже вопросы."
      @update:model-value="patchElement({ prompt: $event })"
    />

    <EditorQuestionPickerField
      :model-value="aiTextElement?.questionKeys ?? []"
      multiple
      label="Вопросы, используемые в промпте"
      @update:model-value="patchElement({ questionKeys: $event })"
    />

    <div class="editor-ai-text-config-screen__length">
      <p class="editor-ai-text-config-screen__length-title">Длина</p>

      <v-btn-toggle
        :model-value="lengthConstraint.unit"
        color="primary"
        density="compact"
        mandatory
        @update:model-value="patchLengthConstraint({ unit: $event })"
      >
        <v-btn value="characters" size="small">Символы</v-btn>
        <v-btn value="words" size="small">Слова</v-btn>
      </v-btn-toggle>

      <div class="editor-ai-text-config-screen__bounds">
        <EditorStepperField
          :model-value="lengthConstraint.min ?? 0"
          label="Минимум"
          :min="0"
          @update:model-value="patchLengthConstraint({ min: $event })"
        />
        <EditorStepperField
          :model-value="lengthConstraint.max ?? 0"
          label="Максимум"
          :min="0"
          @update:model-value="patchLengthConstraint({ max: $event })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import type { AiTextPlaceholder, LengthConstraint } from '../../../models/ai-text-placeholder.model'
import EditorTextField from '../../EditorTextField.vue'
import EditorStepperField from '../../EditorStepperField.vue'
import EditorQuestionPickerField from '../../EditorQuestionPickerField.vue'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const aiTextElement = computed(() => selected.value as AiTextPlaceholder | null)

const lengthConstraint = computed<LengthConstraint>(
  () => aiTextElement.value?.lengthConstraint ?? { unit: 'characters', min: null, max: null },
)

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function patchLengthConstraint(partial: Partial<LengthConstraint>): void {
  patchElement({ lengthConstraint: { ...lengthConstraint.value, ...partial } })
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-ai-text-config-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-ai-text-config-screen__length {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-ai-text-config-screen__length-title {
  margin: 0;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: pp.$ink-faint;
}

.editor-ai-text-config-screen__bounds {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-2;
}
</style>
