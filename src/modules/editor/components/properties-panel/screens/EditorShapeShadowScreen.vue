<template>
  <div class="editor-shape-shadow-screen">
    <div class="editor-shape-shadow-screen__grid">
      <button
        type="button"
        class="editor-shape-shadow-screen__card"
        :class="{ 'editor-shape-shadow-screen__card--active': !activeShadow }"
        @click="selectNone"
      >
        <span class="editor-shape-shadow-screen__card-icon">
          <v-icon size="22" color="textMuted">mdi-square-off-outline</v-icon>
        </span>
        <span class="editor-shape-shadow-screen__card-label">Без тени</span>
      </button>

      <button
        v-for="def in SHAPE_SHADOW_DESCRIPTORS"
        :key="def.type"
        type="button"
        class="editor-shape-shadow-screen__card"
        :class="{ 'editor-shape-shadow-screen__card--active': activeShadow?.type === def.type }"
        @click="selectShadow(def.type)"
      >
        <span class="editor-shape-shadow-screen__card-icon">
          <v-icon size="22">{{ SHAPE_SHADOW_ICONS[def.type] }}</v-icon>
          <v-icon
            v-if="activeShadow?.type === def.type"
            size="14"
            class="editor-shape-shadow-screen__check"
          >
            mdi-check
          </v-icon>
        </span>
        <span class="editor-shape-shadow-screen__card-label">{{ def.label }}</span>
      </button>
    </div>

    <EditorEffectDescriptorForm
      v-if="activeDescriptor && activeShadow"
      :fields="activeDescriptor.fields"
      :params="activeShadow.params"
      @patch="patchParams"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import { SHAPE_SHADOW_DESCRIPTORS, SHAPE_SHADOW_ICONS } from '../../../models/shape-shadow.model'
import type { ShapeShadow, ShapeShadowType } from '../../../models/shape-shadow.model'
import { findDescriptor } from '../../../models/effect-descriptor.model'
import type { ShapeElement } from '../../../models/shape-element.model'
import EditorEffectDescriptorForm from '../EditorEffectDescriptorForm.vue'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const shapeElement = computed(() => selected.value as ShapeElement | null)
const activeShadow = computed<ShapeShadow | null>(() => shapeElement.value?.shadow ?? null)
const activeDescriptor = computed(() =>
  activeShadow.value ? findDescriptor(SHAPE_SHADOW_DESCRIPTORS, activeShadow.value.type) : null,
)

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function selectNone(): void {
  patchElement({ shadow: null })
}

function selectShadow(type: ShapeShadowType): void {
  const def = findDescriptor(SHAPE_SHADOW_DESCRIPTORS, type)
  patchElement({ shadow: { type, params: { ...def.defaultParams } } as ShapeShadow })
}

function patchParams(partial: Record<string, number | string>): void {
  if (!activeShadow.value) {
    return
  }
  patchElement({
    shadow: {
      type: activeShadow.value.type,
      params: { ...activeShadow.value.params, ...partial },
    } as ShapeShadow,
  })
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-shape-shadow-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-shape-shadow-screen__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-2;
}

.editor-shape-shadow-screen__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  gap: $spacing-1;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.editor-shape-shadow-screen__card-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1.5px solid pp.$border;
  border-radius: $radius-sm;
  background: $white;
  color: pp.$ink-soft;
  transition: border-color 0.12s ease;

  .editor-shape-shadow-screen__card:hover & {
    border-color: pp.$border-strong;
  }
}

.editor-shape-shadow-screen__card--active .editor-shape-shadow-screen__card-icon {
  border-color: pp.$accent;
  border-width: 2px;
  background: pp.$accent-tint;
  color: pp.$accent-deep;
}

.editor-shape-shadow-screen__check {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #ffffff;
  background: pp.$accent;
  border-radius: 50%;
  padding: 1px;
}

.editor-shape-shadow-screen__card-label {
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-shape-shadow-screen__card--active .editor-shape-shadow-screen__card-label {
  color: pp.$accent-deep;
  font-weight: $font-weight-semibold;
}
</style>
