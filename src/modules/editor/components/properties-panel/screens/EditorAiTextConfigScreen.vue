<template>
  <div class="editor-ai-text-config-screen">
    <div class="editor-ai-text-config-screen__parts">
      <p class="editor-ai-text-config-screen__section-title">
        {{ isChained ? `Части текста · ${parts.length}` : 'Части текста' }}
      </p>

      <p v-if="!isChained && chainMode !== 'phrases'" class="editor-ai-text-config-screen__hint">
        Один сгенерированный текст можно разложить по нескольким блокам этой страницы или
        разворота — например, на две колонки. Каждая часть получает свою длину, промпт общий.
      </p>

      <ol v-else class="editor-ai-text-config-screen__part-list">
        <li
          v-for="(part, index) in parts"
          :key="part.id"
          class="editor-ai-text-config-screen__part"
          :class="{ 'editor-ai-text-config-screen__part--current': part.id === aiTextElement?.id }"
        >
          <button
            type="button"
            class="editor-ai-text-config-screen__part-select"
            :title="part.id === aiTextElement?.id ? 'Эта часть' : 'Выбрать часть на холсте'"
            @click="store.selectFromLayersPanel(part.id)"
          >
            <span class="editor-ai-text-config-screen__part-number">{{ index + 1 }}</span>
            <span class="editor-ai-text-config-screen__part-meta">
              <span class="editor-ai-text-config-screen__part-name">{{ part.name }}</span>
              <span class="editor-ai-text-config-screen__part-length">
                {{ lengthSummary(part.lengthConstraint) }}<template v-if="part.partHint.trim()"> · {{ part.partHint }}</template>
              </span>
            </span>
          </button>
          <div class="editor-ai-text-config-screen__part-actions">
            <v-btn
              icon="mdi-chevron-up"
              variant="text"
              size="x-small"
              :disabled="index === 0"
              title="Читать раньше"
              @click="store.moveAiTextChainPart(part.id, 'earlier')"
            />
            <v-btn
              icon="mdi-chevron-down"
              variant="text"
              size="x-small"
              :disabled="index === parts.length - 1"
              title="Читать позже"
              @click="store.moveAiTextChainPart(part.id, 'later')"
            />
          </div>
        </li>
      </ol>

      <div class="editor-ai-text-config-screen__part-buttons">
        <v-btn
          variant="outlined"
          size="small"
          prepend-icon="mdi-plus"
          @click="addPart"
        >
          {{ chainMode === 'phrases' ? 'Добавить фразу' : isChained ? 'Добавить часть' : 'Разделить на части' }}
        </v-btn>
        <v-btn
          v-if="isChained"
          variant="text"
          size="small"
          prepend-icon="mdi-link-variant-off"
          @click="unlinkCurrent"
        >
          Отвязать эту часть
        </v-btn>
      </div>

      <p v-if="isChained" class="editor-ai-text-config-screen__hint">
        Номера частей видны на холсте. Новая часть копирует оформление этой и встаёт рядом —
        перетащите её на нужное место. «Дублировать» на части тоже добавляет её в конец.
      </p>

      <template v-if="isChained">
        <p class="editor-ai-text-config-screen__section-title">Как связаны части</p>
        <v-btn-toggle
          :model-value="chainMode"
          color="primary"
          density="compact"
          mandatory
          @update:model-value="patchShared({ chainMode: $event })"
        >
          <v-btn value="continuous" size="small">Единый текст</v-btn>
          <v-btn value="phrases" size="small">Отдельные фразы</v-btn>
        </v-btn-toggle>
        <p class="editor-ai-text-config-screen__hint">
          {{ chainMode === 'phrases'
            ? 'Каждая часть — самостоятельная короткая фраза на общую тему, без повторов. Подходит для анонсов на обложке.'
            : 'Один текст, разбитый на части: каждая продолжает предыдущую. Порядок чтения — сверху вниз по списку.' }}
        </p>
      </template>
    </div>

    <div class="editor-ai-text-config-screen__parts">
      <p class="editor-ai-text-config-screen__section-title">Из чего писать</p>
      <v-btn-toggle
        :model-value="contentSource"
        color="primary"
        density="compact"
        mandatory
        @update:model-value="patchShared({ contentSource: $event })"
      >
        <v-btn value="questions" size="small">Вопросы анкеты</v-btn>
        <v-btn value="journal" size="small">Весь журнал</v-btn>
      </v-btn-toggle>
      <p class="editor-ai-text-config-screen__hint">
        {{ contentSource === 'journal'
          ? 'Текст пишется в конце, когда анкета заполнена: по всем ответам и уже готовым текстам журнала. До этого в блоке — заглушка.'
          : 'Текст пишется сразу, как только пользователь ответит на выбранные ниже вопросы.' }}
      </p>
    </div>

    <EditorTextField
      :model-value="aiTextElement?.prompt ?? ''"
      label="Промпт"
      multiline
      :rows="5"
      :hint="promptHint"
      @update:model-value="patchShared({ prompt: $event })"
    />

    <EditorQuestionPickerField
      :model-value="aiTextElement?.questionKeys ?? []"
      multiple
      :label="contentSource === 'journal' ? 'Дополнительные вопросы (необязательно)' : 'Вопросы, используемые в промпте'"
      @update:model-value="patchShared({ questionKeys: $event })"
    />
    <p v-if="contentSource === 'journal'" class="editor-ai-text-config-screen__hint">
      Зададутся последним шагом анкеты, и ответ AI учтёт в первую очередь — например
      «Что бы вы хотели видеть на обложке?». Сделайте такой вопрос необязательным.
    </p>

    <EditorTextField
      v-if="isChained"
      :model-value="aiTextElement?.partHint ?? ''"
      :label="`О чём ${chainMode === 'phrases' ? 'фраза' : 'часть'} ${currentPartNumber} (необязательно)`"
      :hint="chainMode === 'phrases'
        ? 'Например: «главная черта характера», «увлечение», «мечта». Оставьте пустым — AI сам выберет тему фразы.'
        : 'Например: «знакомство», «главное событие», «пожелание на будущее». Оставьте пустым — AI сам решит, как продолжить текст.'"
      @update:model-value="patchPart({ partHint: $event })"
    />

    <div class="editor-ai-text-config-screen__length">
      <p class="editor-ai-text-config-screen__section-title">
        {{ isChained ? `Длина части ${currentPartNumber}` : 'Длина' }}
      </p>

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

      <v-btn
        variant="text"
        size="small"
        prepend-icon="mdi-fit-to-page-outline"
        class="editor-ai-text-config-screen__fit"
        @click="fitLengthToBox"
      >
        Подобрать по размеру рамки
      </v-btn>
      <p class="editor-ai-text-config-screen__hint">
        Оценка по текущим шрифту, кеглю и размеру блока — после изменения рамки нажмите ещё раз.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { AiTextPlaceholder, LengthConstraint } from '../../../models/ai-text-placeholder.model'
import { isAiTextElement } from '../../../models'
import { getAiTextSiblingParts, type AiTextSharedPatch } from '../../../utils/ai-text-chain.util'
import { buildLengthConstraintForBox } from '../../../utils/ai-text-capacity.util'
import EditorTextField from '../../EditorTextField.vue'
import EditorStepperField from '../../EditorStepperField.vue'
import EditorQuestionPickerField from '../../EditorQuestionPickerField.vue'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const aiTextElement = computed(() =>
  selected.value && isAiTextElement(selected.value) ? (selected.value as AiTextPlaceholder) : null,
)

const parts = computed(() =>
  aiTextElement.value ? getAiTextSiblingParts(store.elements, aiTextElement.value) : [],
)

const isChained = computed(() => parts.value.length > 1)

const chainMode = computed(() => aiTextElement.value?.chainMode ?? 'continuous')
const contentSource = computed(() => aiTextElement.value?.contentSource ?? 'questions')

const promptHint = computed(() => {
  if (!isChained.value) {
    return contentSource.value === 'journal'
      ? 'Опишите, что должен написать AI. В промпт автоматически попадут все ответы анкеты и тексты журнала.'
      : 'Опишите, что должен написать AI. В промпт автоматически попадут ответы на выбранные ниже вопросы.'
  }
  return chainMode.value === 'phrases'
    ? 'Общий для всех фраз. Опишите, о ком и в каком духе писать — например «яркие анонсы для обложки журнала о человеке».'
    : 'Общий для всех частей. Опишите текст целиком — AI сам разобьёт его на части нужной длины.'
})

const currentPartNumber = computed(
  () => parts.value.findIndex((part) => part.id === aiTextElement.value?.id) + 1,
)

const lengthConstraint = computed<LengthConstraint>(
  () => aiTextElement.value?.lengthConstraint ?? { unit: 'characters', min: null, max: null },
)

function lengthSummary(constraint: LengthConstraint): string {
  const unitLabel = constraint.unit === 'words' ? 'слов' : 'симв.'
  if (constraint.min != null && constraint.max != null) {
    return `${constraint.min}–${constraint.max} ${unitLabel}`
  }
  if (constraint.max != null) {
    return `до ${constraint.max} ${unitLabel}`
  }
  if (constraint.min != null) {
    return `от ${constraint.min} ${unitLabel}`
  }
  return 'длина не задана'
}

function patchShared(patch: AiTextSharedPatch): void {
  if (!aiTextElement.value) {
    return
  }
  store.updateAiTextShared(aiTextElement.value.id, patch)
}

function patchPart(patch: Partial<Pick<AiTextPlaceholder, 'partHint' | 'lengthConstraint'>>): void {
  if (!aiTextElement.value) {
    return
  }
  store.updateElement(aiTextElement.value.id, patch)
}

function patchLengthConstraint(partial: Partial<LengthConstraint>): void {
  patchPart({ lengthConstraint: { ...lengthConstraint.value, ...partial } })
}

function fitLengthToBox(): void {
  if (!aiTextElement.value) {
    return
  }
  patchPart({ lengthConstraint: buildLengthConstraintForBox(aiTextElement.value) })
}

function addPart(): void {
  if (aiTextElement.value) {
    store.addAiTextChainPart(aiTextElement.value.id)
  }
}

function unlinkCurrent(): void {
  if (aiTextElement.value) {
    store.unlinkAiTextChainPart(aiTextElement.value.id)
  }
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-ai-text-config-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-ai-text-config-screen__parts,
.editor-ai-text-config-screen__length {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-ai-text-config-screen__section-title {
  margin: 0;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: pp.$ink-faint;
}

.editor-ai-text-config-screen__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: pp.$ink-faint;
}

.editor-ai-text-config-screen__part-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.editor-ai-text-config-screen__part {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 6px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  transition: border-color 150ms ease, background 150ms ease;

  &--current {
    border-color: pp.$accent;
    background: pp.$accent-tint;
  }
}

.editor-ai-text-config-screen__part-select {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}

.editor-ai-text-config-screen__part-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: pp.$accent;
  color: #fff;
  font-size: 11px;
  font-weight: $font-weight-semibold;
}

.editor-ai-text-config-screen__part-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.editor-ai-text-config-screen__part-name {
  overflow: hidden;
  font-size: 12px;
  color: pp.$ink;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-ai-text-config-screen__part-length {
  overflow: hidden;
  font-size: 11px;
  color: pp.$ink-faint;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-ai-text-config-screen__part-actions {
  display: flex;
  flex-shrink: 0;
}

.editor-ai-text-config-screen__part-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.editor-ai-text-config-screen__bounds {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-2;
}

.editor-ai-text-config-screen__fit {
  align-self: flex-start;
}
</style>
