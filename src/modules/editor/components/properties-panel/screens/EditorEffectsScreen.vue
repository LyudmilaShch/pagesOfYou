<template>
  <div class="editor-effects-screen">
    <div class="editor-effects-screen__grid">
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
          <span class="editor-effects-screen__card-demo" :style="getCardDemoStyle(card.type)">Эф</span>
        </span>
        <span class="editor-effects-screen__card-label">{{ card.label }}</span>
      </button>
    </div>

    <EditorEffectSettingsForm
      v-if="activeEffect"
      :effect="activeEffect"
      @patch="patchEffectParams"
    />

    <v-btn
      v-if="activeEffect"
      block
      variant="outlined"
      color="error"
      prepend-icon="mdi-close-circle-outline"
      class="editor-effects-screen__remove"
      @click="removeEffect"
    >
      Удалить эффект
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import { TEXT_EFFECT_CARDS } from '../../../models/text-effect.model'
import type { TextEffect, TextEffectCardDef, TextEffectType } from '../../../models/text-effect.model'
import type { TextPlaceholder } from '../../../models/text-placeholder.model'
import EditorEffectSettingsForm from '../EditorEffectSettingsForm.vue'

/** Accent used only for the effect demo letters on this screen's cards — not a global design token. */
const EFFECT_DEMO_ACCENT = '#F775BB'
const EFFECT_DEMO_ACCENT_RGB = '247, 117, 187'

function getCardDemoStyle(type: TextEffectType): Record<string, string> {
  switch (type) {
    case 'drop-shadow':
      return {
        color: '#111111',
        textShadow: `3px 3px 0 ${EFFECT_DEMO_ACCENT}`,
      }
    case 'glow':
      return {
        color: '#111111',
        textShadow: `0 0 8px ${EFFECT_DEMO_ACCENT}`,
      }
    case 'echo':
      return {
        color: EFFECT_DEMO_ACCENT,
        textShadow: `2px 2px 0 rgba(${EFFECT_DEMO_ACCENT_RGB}, 0.55), 4px 4px 0 rgba(${EFFECT_DEMO_ACCENT_RGB}, 0.3)`,
      }
    case 'outlined':
      return {
        color: '#111111',
        webkitTextStroke: `1px ${EFFECT_DEMO_ACCENT}`,
      }
    case 'background':
      return {
        color: '#ffffff',
        background: EFFECT_DEMO_ACCENT,
        padding: '0 6px',
        borderRadius: '4px',
      }
    case 'stroke':
      return {
        color: 'transparent',
        webkitTextStroke: `1.5px ${EFFECT_DEMO_ACCENT}`,
      }
    case 'neon':
      return {
        color: EFFECT_DEMO_ACCENT,
        textShadow: `0 0 4px ${EFFECT_DEMO_ACCENT}, 0 0 10px rgba(${EFFECT_DEMO_ACCENT_RGB}, 0.7)`,
      }
    default:
      return {}
  }
}

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
  border: 1px solid $border-light;
  border-radius: $radius-lg;
  background: $bg-elevated;
  box-shadow: $shadow-xs;
  overflow: hidden;

  .editor-effects-screen__card:hover & {
    border-color: $border-strong;
  }
}

.editor-effects-screen__card--active .editor-effects-screen__card-box {
  border-color: $text-primary;
  box-shadow: $shadow-sm;
}

.editor-effects-screen__card-label {
  font-size: $font-size-caption;
  color: $text-secondary;
}

.editor-effects-screen__card--active .editor-effects-screen__card-label {
  color: $text-primary;
  font-weight: $font-weight-semibold;
}

.editor-effects-screen__card-badge {
  position: absolute;
  top: $spacing-1;
  right: $spacing-1;
  color: $text-muted;
}

.editor-effects-screen__card-demo {
  font-family: $font-family-display;
  font-size: 34px;
  font-weight: $font-weight-semibold;
  line-height: 1.2;
}

.editor-effects-screen__remove {
  margin-top: $spacing-2;
}
</style>
