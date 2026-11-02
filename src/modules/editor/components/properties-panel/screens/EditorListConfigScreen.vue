<template>
  <div v-if="listInfo && settings" class="editor-list-config-screen">
    <p class="editor-list-config-screen__title">Список · {{ rows.length }} {{ pluralRows(rows.length) }}</p>

    <EditorQuestionPickerField
      v-if="hasEditorQuestions"
      :model-value="settings.questionKey ? [settings.questionKey] : []"
      hint="Вопрос с типом «Список пунктов». Строк в шаблоне — это максимум пунктов в анкете."
      @update:model-value="store.setListQuestion(listInfo.listId, $event[0] ?? null)"
    />

    <EditorStepperField
      :model-value="settings.minItems ?? 0"
      label="Минимум пунктов"
      :min="0"
      :max="rows.length"
      @update:model-value="store.setListMinItems(listInfo.listId, $event)"
    />
    <p class="editor-list-config-screen__hint">
      {{ (settings.minItems ?? 0) > 0
        ? `Пользователь не сможет продолжить, пока не заполнит хотя бы ${settings.minItems} из ${rows.length}.`
        : `Без минимума: можно заполнить от 1 до ${rows.length} пунктов или пропустить вопрос.` }}
    </p>

    <v-select
      :model-value="settings.mode ?? 'slots'"
      :items="LAYOUT_MODES"
      item-title="title"
      item-value="value"
      label="Раскладка, если пунктов меньше"
      variant="outlined"
      density="compact"
      hide-details
      @update:model-value="store.setListMode(listInfo.listId, $event)"
    />
    <p class="editor-list-config-screen__hint">{{ LAYOUT_MODE_HINTS[settings.mode ?? 'slots'] }}</p>

    <div class="editor-list-config-screen__suggest">
      <EditorSwitch
        :model-value="settings.suggestEnabled !== false"
        label="Кнопка «Предложить пункты» (ИИ)"
        @update:model-value="store.setListSuggestSettings(listInfo.listId, { suggestEnabled: $event })"
      />
      <template v-if="settings.suggestEnabled !== false">
        <EditorTextField
          :model-value="settings.suggestPrompt ?? DEFAULT_LIST_SUGGEST_PROMPT"
          label="Промпт для пунктов"
          multiline
          :rows="4"
          hint="Какими должны быть пункты. Сами добавятся: название списка (вопрос), ответы анкеты, уже написанные пункты, сколько пунктов нужно и лимит длины."
          @update:model-value="store.setListSuggestSettings(listInfo.listId, { suggestPrompt: $event })"
        />
        <v-btn
          v-if="settings.suggestPrompt !== undefined && settings.suggestPrompt !== DEFAULT_LIST_SUGGEST_PROMPT"
          variant="text"
          size="small"
          prepend-icon="mdi-restore"
          class="editor-list-config-screen__inline-btn"
          @click="store.setListSuggestSettings(listInfo.listId, { suggestPrompt: undefined })"
        >
          Вернуть стандартный промпт
        </v-btn>
      </template>
    </div>

    <ol class="editor-list-config-screen__rows">
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        class="editor-list-config-screen__row"
        :class="{
          'editor-list-config-screen__row--slot': manualSlots?.includes(index),
          'editor-list-config-screen__row--current': row.id === currentRowId,
        }"
      >
        <v-checkbox-btn
          v-if="manualSlots"
          :model-value="manualSlots.includes(index)"
          density="compact"
          :title="`Место для ${previewCount} пунктов`"
          @update:model-value="toggleSlot(index)"
        />
        <button
          type="button"
          class="editor-list-config-screen__row-select"
          title="Выбрать строку на холсте"
          @click="store.selectFromLayersPanel(row.id)"
        >
          <span class="editor-list-config-screen__row-number">{{ index + 1 }}</span>
          <span class="editor-list-config-screen__row-meta">
            <span class="editor-list-config-screen__row-name">{{ row.name }}</span>
            <span
              class="editor-list-config-screen__row-roles"
              :class="{ 'editor-list-config-screen__row-roles--warn': !row.fromAnswer }"
            >
              {{ row.fromAnswer ? row.roles : 'нет заголовка и описания пункта' }}
            </span>
          </span>
        </button>
        <div class="editor-list-config-screen__row-actions">
          <v-btn
            v-if="index > 0"
            :icon="row.columnBreak ? 'mdi-table-column-plus-before' : 'mdi-table-column'"
            :color="row.columnBreak ? 'primary' : undefined"
            variant="text"
            size="x-small"
            :title="row.columnBreak ? 'Новая колонка начинается с этой строки' : 'Начать новую колонку с этой строки'"
            @click="store.updateElement(row.id, { listColumnBreak: !row.columnBreak })"
          />
          <v-btn
            icon="mdi-chevron-up"
            variant="text"
            size="x-small"
            :disabled="index === 0"
            title="Читать раньше"
            @click="store.moveListRow(listInfo.listId, row.id, 'earlier')"
          />
          <v-btn
            icon="mdi-chevron-down"
            variant="text"
            size="x-small"
            :disabled="index === rows.length - 1"
            title="Читать позже"
            @click="store.moveListRow(listInfo.listId, row.id, 'later')"
          />
          <v-btn
            v-if="rows.length > 1"
            icon="mdi-close"
            variant="text"
            size="x-small"
            title="Убрать строку из списка (сам элемент останется на странице)"
            @click="store.removeListRow(row.id)"
          />
        </div>
      </li>
    </ol>

    <p class="editor-list-config-screen__hint">
      Порядок строк — порядок чтения: сверху вниз, снизу вверх, зигзагом. На развороте колонка
      сама начинается на другой странице; на одной странице отметьте начало колонки значком
      <v-icon size="12">mdi-table-column</v-icon>. У текстов строки выберите роль: номер, заголовок или описание пункта.
    </p>

    <v-btn variant="text" size="small" prepend-icon="mdi-swap-vertical" @click="store.reverseListRows(listInfo.listId)">
      Обратный порядок
    </v-btn>

    <div v-if="previewCanvas" class="editor-list-config-screen__preview">
      <p class="editor-list-config-screen__title">Как будет при {{ previewCount }} из {{ rows.length }}</p>
      <v-slider
        v-model="previewCount"
        :min="Math.max(1, settings.minItems ?? 0)"
        :max="rows.length"
        :step="1"
        density="compact"
        hide-details
        color="primary"
      />
      <div
        class="editor-list-config-screen__thumb"
        :style="{ aspectRatio: `${previewCanvas.pageWidth ?? A4_PAGE_WIDTH} / ${previewCanvas.pageHeight ?? A4_PAGE_HEIGHT}` }"
      >
        <JournalSpreadThumbnail :canvas-data="previewCanvas" />
      </div>

      <template v-if="manualSlots">
        <p
          class="editor-list-config-screen__hint"
          :class="{ 'editor-list-config-screen__hint--warn': manualSlots.length !== previewCount }"
        >
          {{ manualSlots.length === previewCount
            ? `Своя раскладка для ${previewCount}: пункты встанут на отмеченные строки.`
            : `Отмечено ${manualSlots.length} — отметьте ровно ${previewCount}, иначе работает автоматическая раскладка.` }}
        </p>
        <v-btn variant="text" size="small" prepend-icon="mdi-auto-fix" @click="store.setListSlots(listInfo.listId, previewCount, null)">
          Вернуть автоматическую
        </v-btn>
      </template>
      <v-btn v-else variant="outlined" size="small" prepend-icon="mdi-gesture-tap" @click="startManualLayout">
        Настроить вручную для {{ previewCount }}
      </v-btn>
      <p v-if="manualCounts.length > 0" class="editor-list-config-screen__hint">
        Своя раскладка: для {{ manualCounts.join(', ') }} {{ pluralItems(manualCounts[manualCounts.length - 1]) }}.
        Перестановка строк её не сбивает; после удаления строк её стоит проверить.
      </p>
    </div>

    <v-btn
      variant="text"
      size="small"
      color="error"
      prepend-icon="mdi-format-list-bulleted-square"
      @click="removeList"
    >
      Убрать список
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import { useEditorStore } from '../../../store/editor.store'
import { isGroupElement, isTextElement, type ListLayoutMode, type PageElement } from '../../../models'
import type { CanvasData } from '../../../models/canvas-data.model'
import { getDescendants } from '../../../utils/element-tree.util'
import { autoListSlots, collectRoleLeaves, distributeLists, listFoldX } from '../../../utils/list-distribution.util'
import { createEditorQuestion, editorQuestions } from '../../../services/editor-questions'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from '../../../constants/page.constants'
import { PROPERTIES_PANEL_STACK_KEY } from '../../../composables/properties-panel-stack.context'
import EditorQuestionPickerField from '../../EditorQuestionPickerField.vue'
import EditorStepperField from '../../EditorStepperField.vue'
import EditorSwitch from '../../EditorSwitch.vue'
import EditorTextField from '../../EditorTextField.vue'
import { DEFAULT_LIST_SUGGEST_PROMPT } from '../../../models/list.model'
import JournalSpreadThumbnail from '../../JournalSpreadThumbnail.vue'

/** The list's own settings — opened from the "Настройки списка" button on the list, one of its
 * rows or a text in a row (see EditorListSection.vue); works on whichever list that selection is in. */
const store = useEditorStore()
const panelStack = inject(PROPERTIES_PANEL_STACK_KEY, null)

const hasEditorQuestions = computed(() => editorQuestions.value.length > 0 || createEditorQuestion.value !== null)

const listInfo = computed(() => (store.selectedElement ? store.findListOf(store.selectedElement.id) : null))
const settings = computed(() => listInfo.value?.settings ?? null)

/** The row the current selection sits in, highlighted in the rows list. */
const currentRowId = computed(() => {
  const selectedId = store.selectedElement?.id
  if (!listInfo.value || !selectedId) {
    return null
  }
  return (
    listInfo.value.rows.find(
      (row) => row.node.id === selectedId || getDescendants(row.node).some((node) => node.id === selectedId),
    )?.node.id ?? null
  )
})

function textsOf(row: PageElement) {
  return (isGroupElement(row) ? getDescendants(row) : [row]).filter(isTextElement)
}

const rows = computed(() =>
  (listInfo.value?.rows ?? []).map(({ node }) => {
    const texts = textsOf(node)
    return {
      id: node.id,
      name: node.name,
      columnBreak: node.listColumnBreak === true,
      /** Has a title or description — something the answer fills. */
      fromAnswer: texts.some((text) => text.listRole === 'item' || text.listRole === 'detail'),
      roles: [
        texts.some((text) => text.listRole === 'number') ? 'номер' : null,
        texts.some((text) => text.listRole === 'item') ? 'заголовок' : null,
        texts.some((text) => text.listRole === 'detail') ? 'описание' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    }
  }),
)

const foldX = computed(() =>
  listFoldX(store.document?.canvasData.pageWidth ?? A4_PAGE_WIDTH, store.document?.canvasData.pageHeight ?? A4_PAGE_HEIGHT),
)

// Opens on the fewest items a customer may leave — the sparsest layout the admin has to live with.
const previewCount = ref(1)
watch(
  () => [listInfo.value?.listId, rows.value.length, settings.value?.minItems ?? 0] as const,
  ([, count, minItems]) => {
    previewCount.value = Math.max(1, minItems || Math.ceil(count / 2))
  },
  { immediate: true },
)

/** The page as the customer would see it with the first `previewCount` items filled. */
const previewCanvas = computed<CanvasData | null>(() => {
  const document = store.document
  const list = listInfo.value
  if (!document || !list) {
    return null
  }
  const filledIds = new Set(
    list.rows.slice(0, previewCount.value).flatMap((row) => collectRoleLeaves(row.node, 'item')),
  )
  return {
    ...document.canvasData,
    elements: distributeLists(document.canvasData.elements, {
      isItemFilled: (id) => filledIds.has(id),
      pageWidth: document.canvasData.pageWidth ?? A4_PAGE_WIDTH,
      pageHeight: document.canvasData.pageHeight ?? A4_PAGE_HEIGHT,
    }),
  }
})

const LAYOUT_MODES: Array<{ value: ListLayoutMode; title: string }> = [
  { value: 'slots', title: 'По местам шаблона' },
  { value: 'path', title: 'Равномерно по линии' },
  { value: 'start', title: 'Подряд с начала' },
  { value: 'center', title: 'По центру' },
]

const LAYOUT_MODE_HINTS: Record<ListLayoutMode, string> = {
  slots: 'Пункты встают только на места строк шаблона, равномерно от первой до последней.',
  path: 'Пункты распределяются равномерно по линии через все строки — и между ними тоже.',
  start: 'Пункты занимают первые места подряд, остальные остаются пустыми.',
  center: 'Пункты занимают места подряд в середине.',
}

/** The hand-picked places (row indices) for the previewed count, while that count has a manual
 * layout — even an unfinished one (wrong count), so its checkboxes stay as the admin left them. */
const manualSlots = computed(() => {
  const list = listInfo.value
  const stored = list?.settings.slotsByCount?.[String(previewCount.value)]
  if (!list || !stored) {
    return null
  }
  return stored
    .map((slot) => (typeof slot === 'number' ? slot : list.rows.findIndex((row) => row.node.id === slot)))
    .filter((index) => index >= 0 && index < list.rows.length)
})

const manualCounts = computed(() =>
  Object.keys(settings.value?.slotsByCount ?? {})
    .map(Number)
    .sort((a, b) => a - b),
)

/** Starts from what the automatic layout picks now, so the admin only adjusts it. */
function startManualLayout(): void {
  const list = listInfo.value
  if (list) {
    store.setListSlots(list.listId, previewCount.value, autoListSlots(list, previewCount.value, foldX.value))
  }
}

function toggleSlot(index: number): void {
  const list = listInfo.value
  const slots = manualSlots.value
  if (!list || !slots) {
    return
  }
  const next = slots.includes(index) ? slots.filter((slot) => slot !== index) : [...slots, index]
  store.setListSlots(list.listId, previewCount.value, next)
}

function removeList(): void {
  if (listInfo.value) {
    store.removeList(listInfo.value.listId)
    panelStack?.pop()
  }
}

function pluralItems(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'пункта'
  return 'пунктов'
}

function pluralRows(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return 'строк'
  if (mod10 === 1) return 'строка'
  if (mod10 >= 2 && mod10 <= 4) return 'строки'
  return 'строк'
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-list-config-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-list-config-screen__title {
  margin: 0;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: pp.$ink-faint;
}

.editor-list-config-screen__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: pp.$ink-faint;

  &--warn {
    color: rgb(var(--v-theme-error));
  }
}

.editor-list-config-screen__suggest {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-list-config-screen__inline-btn {
  align-self: flex-start;
  letter-spacing: normal;
  text-transform: none;
}

.editor-list-config-screen__rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.editor-list-config-screen__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 6px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;

  &--current {
    border-color: pp.$accent;
  }

  &--slot {
    border-color: pp.$accent;
    background: pp.$accent-tint;
  }
}

.editor-list-config-screen__row-select {
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

.editor-list-config-screen__row-number {
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

.editor-list-config-screen__row-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.editor-list-config-screen__row-name {
  overflow: hidden;
  font-size: 12px;
  color: pp.$ink;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-list-config-screen__row-roles {
  font-size: 11px;
  color: pp.$ink-faint;

  &--warn {
    color: rgb(var(--v-theme-error));
  }
}

.editor-list-config-screen__row-actions {
  display: flex;
  flex-shrink: 0;
}

.editor-list-config-screen__preview {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-list-config-screen__thumb {
  width: 100%;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
}
</style>
