<template>
  <!-- Several elements selected: offer to make them the rows of a new list. -->
  <div v-if="isTemplateEditor && canMakeList" class="editor-properties__section editor-list-section">
    <p class="editor-properties__section-title">Список</p>
    <p class="editor-list-section__hint">
      Каждый выделенный элемент станет строкой списка ({{ store.selectionCount }}). Пользователь
      заполнит столько пунктов, сколько захочет, — заполненные строки встанут по местам строк шаблона.
    </p>
    <v-btn
      variant="outlined"
      size="small"
      prepend-icon="mdi-format-list-numbered"
      :disabled="store.previewMode"
      @click="makeList"
    >
      Сделать списком
    </v-btn>

    <template v-if="pageLists.length > 0">
      <p class="editor-list-section__hint">…или добавить их строками в конец списка на странице:</p>
      <div class="editor-list-section__add">
        <v-select
          v-model="targetListId"
          :items="listOptions"
          item-title="title"
          item-value="value"
          variant="outlined"
          density="compact"
          hide-details
        />
        <v-btn variant="outlined" size="small" :disabled="!targetListId || store.previewMode" @click="addSelectionToList">
          Добавить
        </v-btn>
      </div>
    </template>
  </div>

  <!-- A row of a list, or a text inside a row: a summary — the list's settings open on their own
       screen, so the selected object's own properties stay in reach. -->
  <div v-else-if="isTemplateEditor && list" class="editor-properties__section editor-list-section">
    <p class="editor-properties__section-title">Строка {{ rowNumber }} списка</p>

    <template v-if="textElement">
      <v-select
        :model-value="textElement.listRole ?? 'none'"
        :items="ROLE_OPTIONS"
        item-title="title"
        item-value="value"
        label="Роль в строке"
        variant="outlined"
        density="compact"
        hide-details
        @update:model-value="store.setListRole(textElement.id, $event === 'none' ? null : ($event as ListRole))"
      />
      <p class="editor-list-section__hint">{{ ROLE_HINTS[textElement.listRole ?? 'none'] }}</p>
    </template>

    <p class="editor-list-section__hint">{{ summary }}</p>
    <v-btn variant="outlined" block prepend-icon="mdi-format-list-numbered" @click="openListSettings">
      Настройки списка
    </v-btn>
    <div class="editor-list-section__row-actions">
      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            class="editor-list-section__row-action"
            variant="tonal"
            size="small"
            prepend-icon="mdi-format-paint"
            :disabled="store.previewMode || (list?.rows.length ?? 0) < 2"
            @click="applyRowStyle"
          >
            Стиль всем строкам
          </v-btn>
        </template>
        Шрифт, размер, цвет и эффекты номера и текста пункта этой строки — всем строкам списка
      </v-tooltip>
      <v-tooltip location="top" content-class="editor-tooltip--arrow-top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            class="editor-list-section__row-action"
            variant="tonal"
            size="small"
            color="error"
            prepend-icon="mdi-playlist-remove"
            :disabled="store.previewMode"
            @click="removeRow"
          >
            Убрать из списка
          </v-btn>
        </template>
        Строка перестанет быть частью списка — сам элемент останется на странице
      </v-tooltip>
    </div>
  </div>

  <!-- One element outside any list, on a page that has lists: offer to append it as a row. -->
  <div v-else-if="isTemplateEditor && selected && pageLists.length > 0" class="editor-properties__section editor-list-section">
    <p class="editor-properties__section-title">Список</p>
    <p class="editor-list-section__hint">Добавить этот элемент строкой в конец списка:</p>
    <div class="editor-list-section__add">
      <v-select
        v-model="targetListId"
        :items="listOptions"
        item-title="title"
        item-value="value"
        variant="outlined"
        density="compact"
        hide-details
      />
      <v-btn variant="outlined" size="small" :disabled="!targetListId || store.previewMode" @click="addSelectionToList">
        Добавить
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue'

import { useEditorStore } from '../../store/editor.store'
import { isTextElement, type ListRole } from '../../models'
import { getDescendants } from '../../utils/element-tree.util'
import { collectLists } from '../../utils/list-distribution.util'
import { createEditorQuestion, editorQuestions } from '../../services/editor-questions'
import { PROPERTIES_PANEL_STACK_KEY } from '../../composables/properties-panel-stack.context'

const store = useEditorStore()
const panelStack = inject(PROPERTIES_PANEL_STACK_KEY, null)

/** Lists are a template-authoring tool — the same admin-context gate as the AI-text settings'
 * (the customer's journal editor provides no questions, so it never shows any of this). */
const isTemplateEditor = computed(() => editorQuestions.value.length > 0 || createEditorQuestion.value !== null)

const canMakeList = computed(() => store.isMultiSelection && store.selectionCount >= 2)

const ROLE_OPTIONS: Array<{ value: ListRole | 'none'; title: string }> = [
  { value: 'number', title: 'Номер' },
  { value: 'item', title: 'Заголовок пункта' },
  { value: 'detail', title: 'Описание пункта' },
  { value: 'none', title: 'Обычный текст' },
]

const ROLE_HINTS: Record<ListRole | 'none', string> = {
  number: 'Покажет номер строки среди заполненных: 1, 2, 3…',
  item: 'Сюда попадёт пункт из ответа. Если в строке есть описание — заголовок пункта.',
  detail: 'Сюда попадёт описание пункта. В анкете у каждого пункта появится поле «Описание».',
  none: 'Останется как есть и переместится вместе со строкой.',
}

const selected = computed(() => store.selectedElement)

/** The list the selection is a row of, or sits inside a row of. */
const list = computed(() => (selected.value ? store.findListOf(selected.value.id) : null))
const rowIndex = computed(() => {
  const id = selected.value?.id
  return (
    list.value?.rows.findIndex((row) => row.node.id === id || getDescendants(row.node).some((node) => node.id === id)) ??
    -1
  )
})
const rowNumber = computed(() => (rowIndex.value < 0 ? '' : rowIndex.value + 1))

/** Every list on the page — targets for "add to list". */
const pageLists = computed(() => (store.document ? collectLists(store.document.canvasData.elements) : []))

const listOptions = computed(() =>
  pageLists.value.map((item, index) => {
    const question = item.settings.questionKey
      ? editorQuestions.value.find((candidate) => candidate.key === item.settings.questionKey)?.label
      : null
    return { value: item.listId, title: `${question ?? `Список ${index + 1}`} · ${item.rows.length} строк` }
  }),
)

const chosenListId = ref<string | null>(null)
/** The admin's pick, or the page's first list. */
const targetListId = computed({
  get: () =>
    pageLists.value.some((item) => item.listId === chosenListId.value)
      ? chosenListId.value
      : (pageLists.value[0]?.listId ?? null),
  set: (value) => {
    chosenListId.value = value
  },
})

function addSelectionToList(): void {
  if (targetListId.value) {
    store.addToList(targetListId.value, [...store.selectedElementIds])
  }
}

function applyRowStyle(): void {
  const row = list.value?.rows[rowIndex.value]
  if (row) {
    store.applyListRowStyle(row.node.id)
  }
}

/** Takes out the whole row the selection belongs to (a text inside a row takes its row along). */
function removeRow(): void {
  const row = list.value?.rows[rowIndex.value]
  if (row) {
    store.removeListRow(row.node.id)
  }
}
const textElement = computed(() => (selected.value && isTextElement(selected.value) ? selected.value : null))

const summary = computed(() => {
  if (!list.value) {
    return ''
  }
  const { settings, rows } = list.value
  const question = settings.questionKey
    ? (editorQuestions.value.find((item) => item.key === settings.questionKey)?.label ?? settings.questionKey)
    : 'вопрос не выбран'
  const min = settings.minItems ? ` · минимум ${settings.minItems}` : ''
  return `${rows.length} строк · ${question}${min}`
})

function openListSettings(): void {
  panelStack?.push({ id: 'list-config', title: 'Настройки списка' })
}

/** The rows are made, then the first one is selected so the settings screen has a list to show —
 * opened once the panel has reacted to that selection change (which resets it to the root). */
async function makeList(): Promise<void> {
  const ids = [...store.selectedElementIds]
  const listId = store.makeList(ids)
  const first = listId ? store.findListById(listId)?.rows[0] : null
  if (first) {
    store.selectFromLayersPanel(first.node.id)
    await nextTick()
    openListSettings()
  }
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-list-section__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: pp.$ink-faint;
}

// Two secondary actions side by side under "Настройки списка" — equal halves, sentence case, the
// label allowed to wrap rather than overflow a narrow panel.
.editor-list-section__row-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-2;
}

.editor-list-section__row-action {
  min-width: 0;
  height: auto !important;
  min-height: 32px;
  padding-block: 6px;
  letter-spacing: normal;
  text-transform: none;
  white-space: normal;
  line-height: 1.2;

  :deep(.v-btn__content) {
    white-space: normal;
    text-align: left;
  }
}

.editor-list-section__add {
  display: flex;
  align-items: center;
  gap: $spacing-2;

  > :first-child {
    flex: 1;
    min-width: 0;
  }
}
</style>
