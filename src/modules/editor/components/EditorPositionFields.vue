<template>
  <div class="editor-properties__section">

    <p class="editor-properties__section-title">Позиция и размер</p>

    <div class="editor-properties__mini-row">
      <span class="editor-properties__mini-row-label">{{ positionLabel }}</span>
      <div class="editor-properties__mini-num-row">
        <input
          type="number"
          class="editor-properties__mini-num-field"
          aria-label="X"
          :value="displayPositionX"
          @change="updatePosition('x', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="number"
          class="editor-properties__mini-num-field"
          aria-label="Y"
          :value="selected!.position.y"
          @change="updatePosition('y', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="editor-properties__mini-row">
      <span class="editor-properties__mini-row-label">Ширина / Высота</span>
      <div class="editor-properties__mini-num-row">
        <input
          type="number"
          class="editor-properties__mini-num-field"
          aria-label="Ширина"
          :value="selected!.size.width"
          @change="updateSize('width', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="number"
          class="editor-properties__mini-num-field"
          aria-label="Высота"
          :value="selected!.size.height"
          @change="updateSize('height', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <div class="editor-properties__rotation-row">

      <EditorStepperField
        :model-value="displayRotation"
        label="Поворот"
        suffix="°"
        :step="1"
        :disabled="store.previewMode || selected!.locked"
        @update:model-value="updateRotation($event)"
      />

      <v-btn
        icon
        rounded="circle"
        size="small"
        variant="outlined"
        title="Повернуть на -45°"
        :disabled="store.previewMode || selected!.locked"
        @click="rotateBy(-45)"
      >
        <svg class="editor-properties__align-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 9a8 8 0 1 1 1.3 7.7" />
          <path d="M4 4v5h5" />
        </svg>
      </v-btn>

      <v-btn
        icon
        rounded="circle"
        size="small"
        variant="outlined"
        title="Повернуть на +45°"
        :disabled="store.previewMode || selected!.locked"
        @click="rotateBy(45)"
      >
        <svg class="editor-properties__align-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 9a8 8 0 1 0-1.3 7.7" />
          <path d="M20 4v5h-5" />
        </svg>
      </v-btn>

    </div>

    <div class="editor-properties__section">
      <p class="editor-properties__section-title">Выравнивание</p>
      <div class="editor-properties__align-row">
        <v-btn
          icon
          rounded="circle"
          size="small"
          variant="outlined"
          title="По центру по горизонтали"
          :disabled="store.previewMode || selected!.locked"
          @click="alignToPageCenter('horizontal')"
        >
          <svg class="editor-properties__align-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4v16" />
            <path d="M3 12h6M9 12l-2.5-2.5M9 12l-2.5 2.5" />
            <path d="M21 12h-6M15 12l2.5-2.5M15 12l2.5 2.5" />
          </svg>
        </v-btn>
        <v-btn
          icon
          rounded="circle"
          size="small"
          variant="outlined"
          title="По центру по вертикали"
          :disabled="store.previewMode || selected!.locked"
          @click="alignToPageCenter('vertical')"
        >
          <svg class="editor-properties__align-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12h16" />
            <path d="M12 3v6M12 9l-2.5-2.5M12 9l2.5-2.5" />
            <path d="M12 21v-6M12 15l-2.5 2.5M12 15l2.5 2.5" />
          </svg>
        </v-btn>
        <v-btn
          icon
          rounded="circle"
          size="small"
          variant="outlined"
          title="По центру страницы"
          :disabled="store.previewMode || selected!.locked"
          @click="alignToPageCenter('both')"
        >
          <svg class="editor-properties__align-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </v-btn>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../store/editor.store'
import type { ElementPatch } from '../store/editor.store'
import EditorStepperField from './EditorStepperField.vue'
import { A4_SPREAD_PAGE_HEIGHT, A4_SPREAD_PAGE_WIDTH } from '../constants/page.constants'
import {
  getSpreadPageSide,
  getSpreadPageSideLabel,
  spreadGlobalXToPageLocal,
  spreadPageLocalXToGlobal,
} from '../utils/spread.util'
import { normalizeElementRotation } from '../utils/transformer.util'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const selectedSpreadSide = computed(() => {
  if (!store.isSpreadPage || !selected.value) {
    return null
  }

  return getSpreadPageSide(
    selected.value.position.x,
    A4_SPREAD_PAGE_WIDTH,
    A4_SPREAD_PAGE_HEIGHT,
    selected.value.size.width,
  )
})

const displayPositionX = computed(() => {
  if (!selected.value) {
    return 0
  }

  if (!selectedSpreadSide.value) {
    return selected.value.position.x
  }

  return spreadGlobalXToPageLocal(selected.value.position.x, selectedSpreadSide.value)
})

const positionLabel = computed(() =>
  selectedSpreadSide.value
    ? `X / Y (${getSpreadPageSideLabel(selectedSpreadSide.value)})`
    : 'X / Y',
)

const displayRotation = computed(() =>
  selected.value ? normalizeElementRotation(selected.value.rotation, 0) : 0,
)

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }

  store.updateElement(selected.value.id, patch)
}

function updatePosition(axis: 'x' | 'y', value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  if (axis === 'x' && selectedSpreadSide.value) {
    const raw = toNumber(value, displayPositionX.value)
    const next = store.snapToGridEnabled ? store.snapCoordinate(raw) : raw

    patchElement({
      position: {
        x: spreadPageLocalXToGlobal(next, selectedSpreadSide.value),
      },
    })
    return
  }

  const raw = toNumber(value, selected.value.position[axis])
  const next = store.snapToGridEnabled
    ? store.snapCoordinate(raw)
    : raw

  patchElement({
    position: {
      [axis]: next,
    },
  })
}

function updateSize(axis: 'width' | 'height', value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  patchElement({
    size: {
      [axis]: toNumber(value, selected.value.size[axis]),
    },
  })
}

function updateRotation(value: string | number | null | undefined): void {
  if (!selected.value) {
    return
  }

  patchElement({
    rotation: normalizeElementRotation(value, selected.value.rotation ?? 0),
  })
}

function rotateBy(delta: number): void {
  if (!selected.value || store.previewMode || selected.value.locked) {
    return
  }

  updateRotation(displayRotation.value + delta)
}

function alignToPageCenter(axis: 'horizontal' | 'vertical' | 'both'): void {
  if (!selected.value || store.previewMode || selected.value.locked) {
    return
  }

  store.alignSelectedToPageCenter(axis)
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

// These class names are shared with EditorPropertiesPanel.vue (which renders the other,
// type-specific sections around this component) — duplicated here rather than factored into a
// shared partial because Vue's scoped CSS ties each rule to the component that owns the markup;
// a rule declared in the parent's <style> never matches elements rendered by a child's own
// template unless the child re-declares it.
.editor-properties__section {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
  padding-bottom: $spacing-4;
  border-bottom: 1px solid pp.$border;

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.editor-properties__section-title {
  margin: 0;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: pp.$ink-faint;
}

.editor-properties__mini-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-2;
}

.editor-properties__mini-row-label {
  flex-shrink: 0;
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-properties__mini-num-row {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  flex-shrink: 0;
}

.editor-properties__mini-num-field {
  width: 52px;
  height: 34px;
  padding: 0 $spacing-1;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: $white;
  font-size: $font-size-caption;
  font-family: inherit;
  color: pp.$ink;
  outline: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;

  &:hover {
    border-color: pp.$border-strong;
    background: pp.$field-hover;
  }

  &:focus {
    border-color: pp.$accent;
    background: pp.$field-hover;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }

  appearance: textfield;
  -moz-appearance: textfield;
}

.editor-properties__align-row {
  display: flex;
  gap: $spacing-3;
  flex-wrap: wrap;

  :deep(.v-btn) {
    width: 52px;
    height: 52px;
    color: pp.$ink;
    border-color: pp.$border;
    background: $white;
  }

  :deep(.v-btn:hover) {
    border-color: pp.$border-strong;
    background: pp.$field-hover;
  }
}

.editor-properties__align-icon {
  width: 20px;
  height: 20px;
}

.editor-properties__rotation-row {
  display: flex;
  align-items: flex-end;
  gap: $spacing-2;

  > *:first-child {
    flex: 1;
    min-width: 0;
  }

  :deep(.v-btn) {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    color: pp.$ink;
    border-color: pp.$border;
    background: $white;
  }

  :deep(.v-btn:hover) {
    border-color: pp.$border-strong;
    background: pp.$field-hover;
  }
}
</style>
