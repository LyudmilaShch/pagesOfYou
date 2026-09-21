<template>
  <div class="editor-toc-config-screen">
    <p class="editor-toc-config-screen__hint">
      Строки собираются автоматически из названий разворотов журнала и их реальных номеров
      страниц — редактировать их напрямую нельзя. Шрифт, цвет и эффекты настраиваются как у
      обычного текста, в основной панели свойств.
    </p>

    <EditorStepperField
      :model-value="tocElement?.entryGap ?? 12"
      label="Расстояние между разделами"
      suffix="px"
      :min="0"
      @update:model-value="patchElement({ entryGap: $event })"
    />

    <div class="editor-toc-config-screen__toggle-row">
      <span class="editor-toc-config-screen__toggle-label">Точечная линия к номеру страницы</span>
      <EditorSwitch
        :model-value="tocElement?.dotLeader ?? true"
        @update:model-value="patchElement({ dotLeader: $event })"
      />
    </div>
    <p class="editor-toc-config-screen__hint">
      С включённой линией название всегда слева, а номер страницы справа — выравнивание текста
      (в панели «Типографика») в этом случае не действует.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import type { TocPlaceholder } from '../../../models/toc-placeholder.model'
import EditorStepperField from '../../EditorStepperField.vue'
import EditorSwitch from '../../EditorSwitch.vue'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const tocElement = computed(() => selected.value as TocPlaceholder | null)

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-toc-config-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-toc-config-screen__hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.4;
  color: pp.$ink-faint;
}

.editor-toc-config-screen__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
}

.editor-toc-config-screen__toggle-label {
  font-size: 12px;
  color: pp.$ink-faint;
}
</style>
