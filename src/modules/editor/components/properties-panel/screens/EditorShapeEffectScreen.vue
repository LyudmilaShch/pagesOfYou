<template>
  <div class="editor-shape-effect-screen">
    <div class="editor-shape-effect-screen__grid">
      <button
        type="button"
        class="editor-shape-effect-screen__card"
        :class="{ 'editor-shape-effect-screen__card--active': !activeEffect }"
        @click="selectNone"
      >
        <span class="editor-shape-effect-screen__thumb">
          <span class="editor-shape-effect-screen__swatch" :style="{ background: baseFill }" />
        </span>
        <span class="editor-shape-effect-screen__label">Без эффекта</span>
      </button>

      <button
        v-for="def in SHAPE_VISUAL_EFFECT_DESCRIPTORS"
        :key="def.type"
        type="button"
        class="editor-shape-effect-screen__card"
        :class="{ 'editor-shape-effect-screen__card--active': activeEffect?.type === def.type }"
        @click="selectEffect(def.type)"
      >
        <span class="editor-shape-effect-screen__thumb">
          <span class="editor-shape-effect-screen__swatch" :style="getShapeVisualEffectPreviewStyle(def.type, baseFill)" />
          <v-icon
            v-if="activeEffect?.type === def.type"
            size="14"
            class="editor-shape-effect-screen__check"
          >
            mdi-check
          </v-icon>
        </span>
        <span class="editor-shape-effect-screen__label">{{ def.label }}</span>
      </button>
    </div>

    <div v-if="activeEffect?.type === 'gradient'" class="editor-shape-effect-screen__mode">
      <v-btn-toggle
        :model-value="activeEffect.params.mode"
        color="primary"
        density="compact"
        mandatory
        @update:model-value="patchParams({ mode: $event })"
      >
        <v-btn value="linear" size="small">Линейный</v-btn>
        <v-btn value="radial" size="small">Радиальный</v-btn>
      </v-btn-toggle>
    </div>

    <EditorEffectDescriptorForm
      v-if="activeDescriptor && activeEffect"
      :fields="activeDescriptor.fields"
      :params="activeEffect.params"
      @patch="patchParams"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import { SHAPE_VISUAL_EFFECT_DESCRIPTORS, getShapeVisualEffectPreviewStyle } from '../../../models/shape-visual-effect.model'
import type { ShapeVisualEffect, ShapeVisualEffectType } from '../../../models/shape-visual-effect.model'
import { findDescriptor } from '../../../models/effect-descriptor.model'
import type { ShapeElement } from '../../../models/shape-element.model'
import EditorEffectDescriptorForm from '../EditorEffectDescriptorForm.vue'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const shapeElement = computed(() => selected.value as ShapeElement | null)
const activeEffect = computed<ShapeVisualEffect | null>(() => shapeElement.value?.visualEffect ?? null)
const activeDescriptor = computed(() =>
  activeEffect.value ? findDescriptor(SHAPE_VISUAL_EFFECT_DESCRIPTORS, activeEffect.value.type) : null,
)

const baseFill = computed(() => shapeElement.value?.fill || '#E3DDD5')

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function selectNone(): void {
  patchElement({ visualEffect: null })
}

function selectEffect(type: ShapeVisualEffectType): void {
  const def = findDescriptor(SHAPE_VISUAL_EFFECT_DESCRIPTORS, type)
  patchElement({ visualEffect: { type, params: { ...def.defaultParams } } as ShapeVisualEffect })
}

function patchParams(partial: Record<string, number | string>): void {
  if (!activeEffect.value) {
    return
  }
  patchElement({
    visualEffect: {
      type: activeEffect.value.type,
      params: { ...activeEffect.value.params, ...partial },
    } as ShapeVisualEffect,
  })
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-shape-effect-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-shape-effect-screen__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-2;
}

.editor-shape-effect-screen__card {
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

.editor-shape-effect-screen__thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  padding: $spacing-2;
  border: 1.5px solid pp.$border;
  border-radius: $radius-sm;
  background: $white;
  overflow: hidden;
  transition: border-color 0.12s ease;

  .editor-shape-effect-screen__card:hover & {
    border-color: pp.$border-strong;
  }
}

.editor-shape-effect-screen__swatch {
  width: 60%;
  height: 60%;
  border-radius: $radius-sm;
}

.editor-shape-effect-screen__card--active .editor-shape-effect-screen__thumb {
  border-color: pp.$accent;
  border-width: 2px;
  background: pp.$accent-tint;
}

.editor-shape-effect-screen__check {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #ffffff;
  background: pp.$accent;
  border-radius: 50%;
  padding: 1px;
}

.editor-shape-effect-screen__label {
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-shape-effect-screen__card--active .editor-shape-effect-screen__label {
  color: pp.$accent-deep;
  font-weight: $font-weight-semibold;
}

.editor-shape-effect-screen__mode {
  display: flex;
  justify-content: center;

  // color="primary" alone renders black — Vuetify's .v-theme--light class re-declares the theme
  // variables on the component itself, beating an inherited override from .editor-properties.
  :deep(.v-btn--variant-flat) {
    background: pp.$accent !important;
    color: #fff !important;
  }
}
</style>
