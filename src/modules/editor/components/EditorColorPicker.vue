<template>
  <div class="editor-color-picker">
    <p v-if="label" class="editor-color-picker__label">{{ label }}</p>

    <div class="editor-color-picker__control">
      <div class="editor-color-picker__left">
        <button
          ref="swatchRef"
          type="button"
          class="editor-color-picker__swatch"
          :aria-label="label ?? 'Выбрать цвет'"
          @click="handleSwatchClick"
        >
          <span class="editor-color-picker__swatch-checker" aria-hidden="true" />
          <span
            class="editor-color-picker__swatch-color"
            :style="{ backgroundColor: previewColor }"
            aria-hidden="true"
          />
        </button>

        <input
          v-model="hexDraft"
          class="editor-color-picker__hex"
          type="text"
          maxlength="6"
          spellcheck="false"
          autocapitalize="characters"
          autocomplete="off"
          aria-label="Hex-код цвета"
          @blur="commitHexDraft"
          @keydown.enter.prevent="commitHexDraft"
        />
      </div>

      <span class="editor-color-picker__divider" aria-hidden="true" />

      <div class="editor-color-picker__right">
        <input
          v-model.number="alphaDraft"
          class="editor-color-picker__alpha"
          type="number"
          min="0"
          max="100"
          step="1"
          aria-label="Прозрачность"
          @blur="commitAlphaDraft"
          @keydown.enter.prevent="commitAlphaDraft"
        />

        <span class="editor-color-picker__alpha-suffix" aria-hidden="true">%</span>
      </div>
    </div>

    <!-- Desktop: a standard anchored popover next to the swatch, via Vuetify's own positioning. -->
    <v-menu
      v-if="!isMobileViewport"
      v-model="pickerOpen"
      :activator="swatchRef ?? undefined"
      :close-on-content-click="false"
      location="bottom start"
      :offset="8"
    >
      <div class="editor-color-picker__popover">
        <v-color-picker
          v-model="pickerColor"
          mode="rgba"
          hide-inputs
          hide-header
          hide-eye-dropper
          canvas-height="160"
          width="100%"
          elevation="0"
          color="primary"
          class="editor-color-picker__vuetify-picker"
        />

        <div class="editor-color-picker__popover-fields">
          <label class="editor-color-picker__popover-field">
            <input
              v-model="hexDraft"
              type="text"
              maxlength="6"
              spellcheck="false"
              autocapitalize="characters"
              autocomplete="off"
              @blur="commitHexDraft"
              @keydown.enter.prevent="commitHexDraft"
            />
            <span>HEX</span>
          </label>
          <label class="editor-color-picker__popover-field">
            <input
              v-model.number="rDraft"
              type="number"
              min="0"
              max="255"
              @blur="commitRgbDraft"
              @keydown.enter.prevent="commitRgbDraft"
            />
            <span>R</span>
          </label>
          <label class="editor-color-picker__popover-field">
            <input
              v-model.number="gDraft"
              type="number"
              min="0"
              max="255"
              @blur="commitRgbDraft"
              @keydown.enter.prevent="commitRgbDraft"
            />
            <span>G</span>
          </label>
          <label class="editor-color-picker__popover-field">
            <input
              v-model.number="bDraft"
              type="number"
              min="0"
              max="255"
              @blur="commitRgbDraft"
              @keydown.enter.prevent="commitRgbDraft"
            />
            <span>B</span>
          </label>
          <label class="editor-color-picker__popover-field">
            <input
              v-model.number="alphaDraft"
              type="number"
              min="0"
              max="100"
              @blur="commitAlphaDraft"
              @keydown.enter.prevent="commitAlphaDraft"
            />
            <span>A</span>
          </label>
        </div>
      </div>
    </v-menu>

    <!-- Mobile: a bottom sheet matching the other mobile docks (swipe handle, outside-tap-to-close). -->
    <Teleport v-else to="body">
      <div
        v-if="pickerOpen"
        class="editor-color-picker__sheet-overlay"
        @click.self="pickerOpen = false"
      >
        <div class="editor-color-picker__sheet" :style="sheetDragStyle">
          <div
            class="editor-color-picker__sheet-handle"
            @pointerdown="onSheetHandlePointerDown"
            @pointermove="onSheetHandlePointerMove"
            @pointerup="onSheetHandlePointerUp"
            @pointercancel="onSheetHandlePointerUp"
          >
            <span class="editor-color-picker__sheet-handle-bar" />
          </div>

          <p v-if="label" class="editor-color-picker__popover-title">{{ label }}</p>

          <v-color-picker
            v-model="pickerColor"
            mode="rgba"
            hide-inputs
            hide-header
            hide-eye-dropper
            canvas-height="160"
            width="100%"
            elevation="0"
            color="primary"
            class="editor-color-picker__vuetify-picker"
          />

          <div class="editor-color-picker__popover-fields">
            <label class="editor-color-picker__popover-field">
              <input
                v-model="hexDraft"
                type="text"
                maxlength="6"
                spellcheck="false"
                autocapitalize="characters"
                autocomplete="off"
                @blur="commitHexDraft"
                @keydown.enter.prevent="commitHexDraft"
              />
              <span>HEX</span>
            </label>
            <label class="editor-color-picker__popover-field">
              <input
                v-model.number="rDraft"
                type="number"
                min="0"
                max="255"
                @blur="commitRgbDraft"
                @keydown.enter.prevent="commitRgbDraft"
              />
              <span>R</span>
            </label>
            <label class="editor-color-picker__popover-field">
              <input
                v-model.number="gDraft"
                type="number"
                min="0"
                max="255"
                @blur="commitRgbDraft"
                @keydown.enter.prevent="commitRgbDraft"
              />
              <span>G</span>
            </label>
            <label class="editor-color-picker__popover-field">
              <input
                v-model.number="bDraft"
                type="number"
                min="0"
                max="255"
                @blur="commitRgbDraft"
                @keydown.enter.prevent="commitRgbDraft"
              />
              <span>B</span>
            </label>
            <label class="editor-color-picker__popover-field">
              <input
                v-model.number="alphaDraft"
                type="number"
                min="0"
                max="100"
                @blur="commitAlphaDraft"
                @keydown.enter.prevent="commitAlphaDraft"
              />
              <span>A</span>
            </label>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useMobileViewport } from '../composables/use-mobile-viewport'
import {
  clampAlphaPercent,
  formatCssColor,
  normalizeHexInput,
  parseCssColor,
} from '../utils/color-format.util'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    fallback?: string
  }>(),
  {
    fallback: '#111111',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isMobileViewport = useMobileViewport()
const swatchRef = ref<HTMLButtonElement | null>(null)
const pickerOpen = ref(false)
const hexDraft = ref('')
const alphaDraft = ref(100)
const rDraft = ref(0)
const gDraft = ref(0)
const bDraft = ref(0)

const parsedColor = computed(() => parseCssColor(props.modelValue, props.fallback))

const previewColor = computed(() => formatCssColor(parsedColor.value))

// Bridges our r/g/b/alpha(0-1) model to Vuetify's VColorPicker rgba object shape — the picker's
// own canvas/hue/alpha sliders stay the single source of drag interaction, while HEX/R/G/B/A stay
// driven by the same emitColor/emitRgba round-trip as the compact inline row above, so editing
// either surface keeps both in sync via props.modelValue.
const pickerColor = computed({
  get: () => ({
    r: parsedColor.value.r,
    g: parsedColor.value.g,
    b: parsedColor.value.b,
    a: parsedColor.value.alpha,
  }),
  set: (value: { r: number; g: number; b: number; a?: number }) => {
    emitRgba(value.r, value.g, value.b, value.a ?? 1)
  },
})

function handleSwatchClick(): void {
  // Desktop opens/closes via v-menu's own activator binding (see :activator="swatchRef" above);
  // this only needs to drive pickerOpen directly for the mobile bottom sheet, which has no v-menu.
  if (isMobileViewport.value) {
    pickerOpen.value = true
  }
}

function syncDraftsFromModel(): void {
  const parsed = parsedColor.value
  hexDraft.value = parsed.hex
  alphaDraft.value = parsed.alphaPercent
  rDraft.value = parsed.r
  gDraft.value = parsed.g
  bDraft.value = parsed.b
}

function emitColor(nextHex: string, nextAlphaPercent: number): void {
  const parsed = parseCssColor(`#${normalizeHexInput(nextHex)}`, props.fallback)
  const alpha = clampAlphaPercent(nextAlphaPercent, parsed.alphaPercent) / 100

  emit(
    'update:modelValue',
    formatCssColor({
      r: parsed.r,
      g: parsed.g,
      b: parsed.b,
      alpha,
    }),
  )
}

function emitRgba(r: number, g: number, b: number, alpha: number): void {
  emit('update:modelValue', formatCssColor({ r, g, b, alpha }))
}

function clampChannelDraft(value: number): number {
  return Number.isFinite(value) ? Math.min(255, Math.max(0, Math.round(value))) : 0
}

function commitHexDraft(): void {
  const normalized = normalizeHexInput(hexDraft.value)

  if (normalized.length !== 6) {
    syncDraftsFromModel()
    return
  }

  hexDraft.value = normalized
  emitColor(normalized, alphaDraft.value)
}

function commitRgbDraft(): void {
  emitRgba(
    clampChannelDraft(rDraft.value),
    clampChannelDraft(gDraft.value),
    clampChannelDraft(bDraft.value),
    alphaDraft.value / 100,
  )
}

function commitAlphaDraft(): void {
  alphaDraft.value = clampAlphaPercent(alphaDraft.value, parsedColor.value.alphaPercent)
  emitColor(hexDraft.value, alphaDraft.value)
}

watch(
  () => props.modelValue,
  () => {
    syncDraftsFromModel()
  },
  { immediate: true },
)

// Mobile sheet swipe-down-to-close — same drag/threshold pattern as the other mobile docks
// (EditorMobileMultiSelectBar.vue etc.): translateY follows the finger, release past a distance
// or velocity threshold closes it.
const SHEET_CLOSE_DRAG_THRESHOLD = 90
const SHEET_CLOSE_DRAG_VELOCITY = 0.5

const sheetDragOffset = ref(0)
const sheetDragging = ref(false)
let sheetDragStartY = 0
let sheetDragStartTime = 0

const sheetDragStyle = computed(() => ({
  transform: sheetDragOffset.value ? `translateY(${sheetDragOffset.value}px)` : undefined,
  transition: sheetDragging.value ? 'none' : undefined,
}))

function onSheetHandlePointerDown(event: PointerEvent): void {
  sheetDragging.value = true
  sheetDragStartY = event.clientY
  sheetDragStartTime = Date.now()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onSheetHandlePointerMove(event: PointerEvent): void {
  if (!sheetDragging.value) {
    return
  }

  sheetDragOffset.value = Math.max(0, event.clientY - sheetDragStartY)
}

function onSheetHandlePointerUp(): void {
  if (!sheetDragging.value) {
    return
  }

  sheetDragging.value = false

  const distance = sheetDragOffset.value
  const elapsed = Math.max(Date.now() - sheetDragStartTime, 1)
  const velocity = distance / elapsed
  const shouldClose = distance > SHEET_CLOSE_DRAG_THRESHOLD || velocity > SHEET_CLOSE_DRAG_VELOCITY

  sheetDragOffset.value = 0

  if (shouldClose) {
    pickerOpen.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-color-picker {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-color-picker__label {
  margin: 0;
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-color-picker__control {
  position: relative;
  display: flex;
  align-items: stretch;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: pp.$border-strong;
  }

  &:focus-within {
    border-color: pp.$accent;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }
}

.editor-color-picker__left {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  flex: 1;
  min-width: 0;
  padding: $spacing-2 11px;
  cursor: text;
}

.editor-color-picker__right {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 0 0 auto;
  padding: $spacing-2 12px;
}

.editor-color-picker__swatch {
  position: relative;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  background: transparent;
}

.editor-color-picker__swatch-checker {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(45deg, #d9d5cf 25%, transparent 25%),
    linear-gradient(-45deg, #d9d5cf 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d9d5cf 75%),
    linear-gradient(-45deg, transparent 75%, #d9d5cf 75%);
  background-size: 8px 8px;
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
}

.editor-color-picker__swatch-color {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgb(17 17 17 / 8%);
}

.editor-color-picker__hex {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: $font-size-body;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: pp.$ink;
  text-transform: uppercase;
  outline: none;
}

.editor-color-picker__divider {
  flex: 0 0 auto;
  width: 1px;
  align-self: stretch;
  background: pp.$border;
}

.editor-color-picker__alpha {
  flex: 0 0 auto;
  width: 36px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: $font-size-body;
  font-weight: 500;
  color: pp.$ink;
  text-align: right;
  outline: none;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }

  appearance: textfield;
  -moz-appearance: textfield;
}

.editor-color-picker__alpha-suffix {
  flex: 0 0 auto;
  font-size: $font-size-caption;
  color: pp.$ink-faint;
}

.editor-color-picker__popover {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 260px;
  padding: 14px;
  background: $white;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(13, 13, 13, 0.22);
}

.editor-color-picker__popover-title {
  margin: 0 0 2px;
  font-family: pp.$font-display;
  font-size: 15px;
  font-weight: 600;
  color: pp.$ink;
}

.editor-color-picker__vuetify-picker {
  border-radius: pp.$radius;

  :deep(.v-color-picker-canvas) {
    border-radius: pp.$radius pp.$radius 0 0;
  }
}

.editor-color-picker__popover-fields {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.editor-color-picker__popover-field {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  input {
    width: 100%;
    padding: 6px 2px;
    border: 1px solid pp.$border;
    border-radius: pp.$radius;
    background: transparent;
    font-size: $font-size-caption;
    font-weight: 500;
    color: pp.$ink;
    text-align: center;
    outline: none;
    text-transform: uppercase;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      border-color: pp.$accent;
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

  span {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: pp.$ink-faint;
  }
}

.editor-color-picker__sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: flex-end;
  background: rgba(13, 13, 13, 0.45);
}

.editor-color-picker__sheet {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 4px 20px calc(20px + env(safe-area-inset-bottom, 20px));
  background: $white;
  border-top: 1px solid pp.$border-strong;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -4px 20px rgba(13, 13, 13, 0.08);
  transition: transform 0.2s ease;
}

.editor-color-picker__sheet-handle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;
  touch-action: none;
  cursor: grab;
}

.editor-color-picker__sheet-handle-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: pp.$border-strong;
}
</style>
