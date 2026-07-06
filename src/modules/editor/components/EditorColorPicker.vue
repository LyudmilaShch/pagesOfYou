<template>
  <div class="editor-color-picker">
    <p v-if="label" class="editor-color-picker__label">{{ label }}</p>

    <div class="editor-color-picker__control">
      <button
        type="button"
        class="editor-color-picker__swatch"
        :aria-label="label ?? 'Выбрать цвет'"
        @click="openNativePicker"
      >
        <span class="editor-color-picker__swatch-checker" aria-hidden="true" />
        <span
          class="editor-color-picker__swatch-color"
          :style="{ backgroundColor: previewColor }"
          aria-hidden="true"
        />
        <input
          ref="nativeInputRef"
          type="color"
          class="editor-color-picker__native"
          tabindex="-1"
          :value="nativeColorValue"
          @input="handleNativeInput"
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

      <span class="editor-color-picker__divider" aria-hidden="true" />

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
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  clampAlphaPercent,
  formatCssColor,
  normalizeHexInput,
  parseCssColor,
  toNativeColorInputValue,
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

const nativeInputRef = ref<HTMLInputElement | null>(null)
const hexDraft = ref('')
const alphaDraft = ref(100)

const parsedColor = computed(() => parseCssColor(props.modelValue, props.fallback))

const nativeColorValue = computed(() => toNativeColorInputValue(parsedColor.value))

const previewColor = computed(() => formatCssColor(parsedColor.value))

function syncDraftsFromModel(): void {
  const parsed = parsedColor.value
  hexDraft.value = parsed.hex
  alphaDraft.value = parsed.alphaPercent
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

function openNativePicker(): void {
  nativeInputRef.value?.click()
}

function handleNativeInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  const parsed = parseCssColor(value, props.fallback)
  hexDraft.value = parsed.hex
  emitColor(parsed.hex, alphaDraft.value)
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
</script>

<style scoped lang="scss">
.editor-color-picker {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-color-picker__label {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-secondary;
}

.editor-color-picker__control {
  position: relative;
  display: flex;
  align-items: center;
  gap: $spacing-2;
  min-height: 40px;
  padding: 0 $spacing-3;
  border: 1px solid $border-default;
  border-radius: $radius-sm;
  background: transparent;
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

.editor-color-picker__native {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
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
  color: $text-primary;
  text-transform: uppercase;
  outline: none;
}

.editor-color-picker__divider {
  flex: 0 0 auto;
  width: 1px;
  height: 22px;
  background: $border-default;
}

.editor-color-picker__alpha {
  flex: 0 0 auto;
  width: 36px;
  padding: 0;
  border: none;
  background: transparent;
  font-size: $font-size-body;
  font-weight: 500;
  color: $text-primary;
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
  color: $text-muted;
}
</style>
