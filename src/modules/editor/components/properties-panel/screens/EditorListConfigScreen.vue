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

    <div v-for="field in limitFields" :key="field.key" class="editor-list-config-screen__limit">
      <p class="editor-list-config-screen__title">{{ field.title }}</p>
      <div class="editor-list-config-screen__limit-row">
        <v-btn-toggle
          :model-value="settings[field.setting]?.unit ?? 'characters'"
          class="editor-list-config-screen__limit-unit"
          color="primary"
          density="compact"
          mandatory
          @update:model-value="setLimit(field.key, { unit: $event, max: settings[field.setting]?.max ?? 0 })"
        >
          <v-btn value="characters" size="small">Символы</v-btn>
          <v-btn value="words" size="small">Слова</v-btn>
        </v-btn-toggle>
        <EditorStepperField
          :model-value="settings[field.setting]?.max ?? 0"
          label="Максимум"
          :min="0"
          @update:model-value="setLimit(field.key, { unit: settings[field.setting]?.unit ?? 'characters', max: $event })"
        />
      </div>
      <p class="editor-list-config-screen__hint">
        {{ (settings[field.setting]?.max ?? 0) > 0
          ? `В анкете: ${describeLimit(settings[field.setting]!)}. Столько же просим у ИИ в «Предложить пункты».`
          : 'Не задано — лимит берётся из самого текста шаблона, в символах.' }}
      </p>
    </div>

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

    <v-select
      :model-value="settings.heightMode ?? 'fixed'"
      :items="HEIGHT_MODES"
      item-title="title"
      item-value="value"
      label="Высота строк"
      variant="outlined"
      density="compact"
      hide-details
      @update:model-value="store.setListFlowSettings(listInfo.listId, { heightMode: $event })"
    />
    <p class="editor-list-config-screen__hint">
      {{ settings.heightMode === 'text'
        ? 'Область колонки (от верха первой строки до низа последней) не двигается — строки внутри неё раздвигаются по реальной высоте текста. Только для вертикальных колонок.'
        : 'Строки стоят ровно на своих местах; длинное описание может наехать на следующую строку.' }}
    </p>
    <template v-if="settings.heightMode === 'text'">
      <v-select
        :model-value="settings.flowAlign ?? 'spread'"
        :items="FLOW_ALIGNS"
        item-title="title"
        item-value="value"
        label="Если текста мало"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="store.setListFlowSettings(listInfo.listId, { flowAlign: $event })"
      />
      <EditorStepperField
        :model-value="settings.minGap ?? DEFAULT_LIST_MIN_GAP"
        label="Минимальный отступ между строками"
        suffix="pt"
        :min="0"
        @update:model-value="store.setListFlowSettings(listInfo.listId, { minGap: $event })"
      />
      <EditorStepperField
        :model-value="Math.round((settings.minFontScale ?? DEFAULT_LIST_MIN_FONT_SCALE) * 100)"
        label="Шрифт можно уменьшить до"
        suffix="%"
        :min="50"
        :max="100"
        :step="5"
        @update:model-value="store.setListFlowSettings(listInfo.listId, { minFontScale: $event / 100 })"
      />
      <p class="editor-list-config-screen__hint">
        Если строки не влезают даже с минимальным отступом, сначала уменьшается шрифт описаний до указанного
        процента, затем — заголовков. Отступ между заголовком и описанием уменьшается вместе с заголовком.
        Не хватит и этого — пользователь увидит ⚠ на проверке.
      </p>
    </template>

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
      <v-btn-toggle
        v-model="previewText"
        class="editor-list-config-screen__preview-toggle"
        color="primary"
        density="compact"
        mandatory
      >
        <v-btn value="template" size="small">Текст шаблона</v-btn>
        <v-btn value="long" size="small">Длинный текст</v-btn>
      </v-btn-toggle>
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
import {
  isGroupElement,
  isTextElement,
  type ListFlowAlign,
  type ListHeightMode,
  type ListLayoutMode,
  type ListTextLimit,
  type PageElement,
  type TextPlaceholder,
} from '../../../models'
import type { CanvasData } from '../../../models/canvas-data.model'
import { getDescendants, mapTree } from '../../../utils/element-tree.util'
import { autoListSlots, collectAnswerLeaves, distributeLists, listFoldX } from '../../../utils/list-distribution.util'
import { measureListTextHeight } from '../../../utils/list-text-measure.util'
import { clampToLimit, describeLimit } from '../../../utils/list-text-limit.util'
import { createEditorQuestion, editorQuestions } from '../../../services/editor-questions'
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from '../../../constants/page.constants'
import { PROPERTIES_PANEL_STACK_KEY } from '../../../composables/properties-panel-stack.context'
import EditorQuestionPickerField from '../../EditorQuestionPickerField.vue'
import EditorStepperField from '../../EditorStepperField.vue'
import EditorSwitch from '../../EditorSwitch.vue'
import EditorTextField from '../../EditorTextField.vue'
import {
  DEFAULT_LIST_MIN_FONT_SCALE,
  DEFAULT_LIST_MIN_GAP,
  DEFAULT_LIST_SUGGEST_PROMPT,
} from '../../../models/list.model'
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

/** "Длина заголовка" always; "Длина описания" once some row has a description text. */
const limitFields = computed(() => [
  { key: 'title' as const, setting: 'titleLimit' as const, title: 'Длина заголовка пункта' },
  ...(rows.value.some((row) => row.roles.includes('описание'))
    ? [{ key: 'detail' as const, setting: 'detailLimit' as const, title: 'Длина описания пункта' }]
    : []),
])

/** A max of 0 clears the limit — back to the texts' own maxLength. */
function setLimit(field: 'title' | 'detail', limit: ListTextLimit): void {
  if (listInfo.value) {
    store.setListTextLimit(listInfo.value.listId, field, limit.max > 0 ? limit : null)
  }
}

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
    list.rows.slice(0, previewCount.value).flatMap((row) => collectAnswerLeaves(row.node)),
  )
  // "Длинный текст": the filled rows' titles/descriptions filled up to their limits — the worst case
  // a text-height layout has to cope with.
  const elements =
    previewText.value === 'long'
      ? mapTree(document.canvasData.elements, (leaf) =>
          filledIds.has(leaf.id) && isTextElement(leaf) ? { ...leaf, defaultText: longSample(leaf) } : leaf,
        )
      : document.canvasData.elements
  return {
    ...document.canvasData,
    elements: distributeLists(elements, {
      isItemFilled: (id) => filledIds.has(id),
      pageWidth: document.canvasData.pageWidth ?? A4_PAGE_WIDTH,
      pageHeight: document.canvasData.pageHeight ?? A4_PAGE_HEIGHT,
      measureTextHeight: measureListTextHeight,
    }),
  }
})

const previewText = ref<'template' | 'long'>('template')

const LONG_TITLE = 'Длинный заголовок пункта'
const LONG_DETAIL =
  'Длинное описание пункта, которое пользователь может написать в анкете: несколько предложений о том, ' +
  'почему это важно и как это было. Ещё одна фраза, чтобы текст занял больше строк. '

/** The worst case a customer can type: up to the list's own limit for the title/description when the
 * admin set one; without it, a description runs to its text's `maxLength` (or a generous default)
 * and a title is just a short phrase (titles stay short in practice, whatever their raw limit). */
function longSample(text: TextPlaceholder): string {
  const isDetail = text.listRole === 'detail'
  const limit = isDetail ? settings.value?.detailLimit : settings.value?.titleLimit
  const source = isDetail ? LONG_DETAIL : `${LONG_TITLE} `
  if (limit && limit.max > 0) {
    const repeated = source.repeat(limit.unit === 'words' ? limit.max : Math.ceil(limit.max / source.length) + 1)
    return clampToLimit(repeated, limit).trim()
  }
  if (!isDetail) {
    return text.maxLength > 0 ? LONG_TITLE.slice(0, text.maxLength).trim() : LONG_TITLE
  }
  const length = text.maxLength > 0 ? text.maxLength : 200
  return LONG_DETAIL.repeat(Math.ceil(length / LONG_DETAIL.length)).slice(0, length).trim()
}

const HEIGHT_MODES: Array<{ value: ListHeightMode; title: string }> = [
  { value: 'fixed', title: 'Фиксированные места' },
  { value: 'text', title: 'По тексту' },
]

const FLOW_ALIGNS: Array<{ value: ListFlowAlign; title: string }> = [
  { value: 'spread', title: 'Растянуть по области' },
  { value: 'top', title: 'Сверху, отступы как в шаблоне' },
  { value: 'center', title: 'По центру, отступы как в шаблоне' },
]

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

// Two equal halves across the panel, sentence case — the default toggle overflows a narrow panel.
.editor-list-config-screen__preview-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;

  :deep(.v-btn) {
    min-width: 0;
    letter-spacing: normal;
    text-transform: none;
  }
}

.editor-list-config-screen__limit {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

// Stacked, not side by side — the panel is too narrow for a stepper's label next to the toggle.
.editor-list-config-screen__limit-row {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-list-config-screen__limit-unit {
  display: grid;
  grid-template-columns: 1fr 1fr;

  :deep(.v-btn) {
    min-width: 0;
    letter-spacing: normal;
    text-transform: none;
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
