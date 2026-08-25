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
          <v-icon size="22">{{ SHADOW_ICONS[def.type] }}</v-icon>
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
import { SHAPE_SHADOW_DESCRIPTORS } from '../../../models/shape-shadow.model'
import type { ShapeShadow, ShapeShadowType } from '../../../models/shape-shadow.model'
import { findDescriptor } from '../../../models/effect-descriptor.model'
import type { ShapeElement } from '../../../models/shape-element.model'
import EditorEffectDescriptorForm from '../EditorEffectDescriptorForm.vue'

const SHADOW_ICONS: Record<ShapeShadowType, string> = {
  drop: 'mdi-box-shadow',
  inner: 'mdi-square-opacity',
  soft: 'mdi-blur',
  long: 'mdi-arrow-bottom-right-thin',
}

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
  border: 1px solid $border-light;
  border-radius: $radius-lg;
  background: $bg-elevated;
  box-shadow: $shadow-xs;
  color: $text-secondary;

  .editor-shape-shadow-screen__card:hover & {
    border-color: $border-strong;
  }
}

.editor-shape-shadow-screen__card--active .editor-shape-shadow-screen__card-icon {
  border-color: $text-primary;
  background: $bg-primary;
  box-shadow: $shadow-sm;
  color: $text-primary;
}

.editor-shape-shadow-screen__check {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #ffffff;
  background: $text-primary;
  border-radius: 50%;
  padding: 1px;
}

.editor-shape-shadow-screen__card-label {
  font-size: $font-size-caption;
  color: $text-secondary;
}

.editor-shape-shadow-screen__card--active .editor-shape-shadow-screen__card-label {
  color: $text-primary;
  font-weight: $font-weight-semibold;
}
</style>
