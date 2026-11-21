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

    <v-btn
      variant="outlined"
      block
      prepend-icon="mdi-format-list-numbered"
      :disabled="store.previewMode"
      @click="tocChoiceOpen = true"
    >
      Сделать списком
    </v-btn>
    <p class="editor-toc-config-screen__hint">
      Вместо одного блока появятся строки на обеих страницах разворота. Их можно двигать, распределять
      и настраивать отступы и шрифт, как у списка. Названия и номера по-прежнему соберутся сами.
    </p>

    <EditorTocDescriptionDialog v-model:open="tocChoiceOpen" @choose="replaceWithList" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import type { TocPlaceholder } from '../../../models/toc-placeholder.model'
import EditorStepperField from '../../EditorStepperField.vue'
import EditorTocDescriptionDialog from '../../EditorTocDescriptionDialog.vue'
import { loadTocAdminSamples } from '../../../utils/toc-admin-samples'

const store = useEditorStore()
const route = useRoute()
const { selectedElement: selected } = storeToRefs(store)
const tocChoiceOpen = ref(false)

const tocElement = computed(() => selected.value as TocPlaceholder | null)

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

async function replaceWithList(showDescription: boolean): Promise<void> {
  if (!selected.value) {
    return
  }
  const typeId = route.params.magazineTypeId
  let samples: Awaited<ReturnType<typeof loadTocAdminSamples>> = []
  if (typeof typeId === 'string') {
    try {
      samples = await loadTocAdminSamples(typeId)
    } catch {
      samples = []
    }
  }
  const row = store.replaceTocWithList(selected.value.id, { showDescription, samples })
  if (row) {
    store.selectFromLayersPanel(row.id)
  }
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
</style>
