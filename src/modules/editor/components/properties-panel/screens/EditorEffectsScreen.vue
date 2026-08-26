<template>
  <div class="editor-effects-screen">
    <div class="editor-effects-screen__grid">
      <button
        type="button"
        class="editor-effects-screen__card"
        :class="{ 'editor-effects-screen__card--active': !activeEffect }"
        @click="removeEffect"
      >
        <span class="editor-effects-screen__card-box">
          <span class="editor-effects-screen__card-demo">Аа</span>
        </span>
        <span class="editor-effects-screen__card-label">Без эффекта</span>
      </button>

      <button
        v-for="card in TEXT_EFFECT_CARDS"
        :key="card.type"
        type="button"
        class="editor-effects-screen__card"
        :class="{ 'editor-effects-screen__card--active': activeEffect?.type === card.type }"
        @click="selectEffect(card)"
      >
        <span class="editor-effects-screen__card-box">
          <v-icon
            v-if="!card.rendersOnCanvas"
            size="14"
            class="editor-effects-screen__card-badge"
            aria-label="Предпросмотр скоро"
          >
            mdi-eye-off-outline
          </v-icon>
          <span class="editor-effects-screen__card-demo" :style="getTextEffectDemoStyle(card.type)">Аа</span>
        </span>
        <span class="editor-effects-screen__card-label">{{ card.label }}</span>
      </button>
    </div>

    <EditorEffectSettingsForm
      v-if="activeEffect"
      :effect="activeEffect"
      @patch="patchEffectParams"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import { TEXT_EFFECT_CARDS, getTextEffectDemoStyle } from '../../../models/text-effect.model'
import type { TextEffect, TextEffectCardDef } from '../../../models/text-effect.model'
import type { TextPlaceholder } from '../../../models/text-placeholder.model'
import EditorEffectSettingsForm from '../EditorEffectSettingsForm.vue'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const textElement = computed(() => selected.value as TextPlaceholder | null)
const activeEffect = computed<TextEffect | null>(() => textElement.value?.effect ?? null)

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function selectEffect(card: TextEffectCardDef): void {
  if (activeEffect.value?.type === card.type) {
    return
  }
  patchElement({ effect: { type: card.type, params: card.defaultParams } as TextEffect })
}

function patchEffectParams(partial: Record<string, unknown>): void {
  if (!activeEffect.value) {
    return
  }
  patchElement({
    effect: {
      type: activeEffect.value.type,
      params: { ...activeEffect.value.params, ...partial },
    } as TextEffect,
  })
}

function removeEffect(): void {
  patchElement({ effect: null })
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-effects-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-effects-screen__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-2;
}

.editor-effects-screen__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  gap: $spacing-2;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.editor-effects-screen__card-box {
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

  .editor-effects-screen__card:hover & {
    border-color: pp.$border-strong;
  }
}

.editor-effects-screen__card--active .editor-effects-screen__card-box {
  border-color: pp.$accent;
  border-width: 2px;
}

.editor-effects-screen__card-label {
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-effects-screen__card--active .editor-effects-screen__card-label {
  color: pp.$accent-deep;
  font-weight: $font-weight-semibold;
}

.editor-effects-screen__card-badge {
  position: absolute;
  top: $spacing-1;
  right: $spacing-1;
  color: pp.$ink-faint;
}

.editor-effects-screen__card-demo {
  font-family: pp.$font-display;
  font-size: 34px;
  font-weight: $font-weight-bold;
  line-height: 1.2;
}
</style>
