<template>
  <div class="editor-stepper-field" :class="`editor-stepper-field--${size}`">
    <v-text-field
      class="editor-stepper-field__input"
      :model-value="modelValue"
      :label="label"
      :suffix="suffix"
      type="number"
      variant="outlined"
      density="compact"
      hide-details
      hide-spin-buttons
      :disabled="disabled"
      :min="min"
      :max="max"
      :step="step"
      @update:model-value="onInput"
      @keydown.up.prevent="increment"
      @keydown.down.prevent="decrement"
    />

    <div class="editor-stepper-field__stepper">
      <button
        type="button"
        class="editor-stepper-field__btn"
        tabindex="-1"
        aria-label="Увеличить"
        :disabled="disabled"
        @click="increment"
      >
        <v-icon size="10">mdi-chevron-up</v-icon>
      </button>
      <button
        type="button"
        class="editor-stepper-field__btn"
        tabindex="-1"
        aria-label="Уменьшить"
        :disabled="disabled"
        @click="decrement"
      >
        <v-icon size="10">mdi-chevron-down</v-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: number
    label?: string
    suffix?: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    size?: 'default' | 'mini'
  }>(),
  {
    step: 1,
    disabled: false,
    size: 'default',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function clamp(value: number): number {
  let next = value

  if (props.min !== undefined) {
    next = Math.max(props.min, next)
  }

  if (props.max !== undefined) {
    next = Math.min(props.max, next)
  }

  return next
}

function onInput(value: string): void {
  const parsed = Number(value)
  emit('update:modelValue', clamp(Number.isFinite(parsed) ? parsed : props.modelValue))
}

function increment(): void {
  if (props.disabled) {
    return
  }

  emit('update:modelValue', clamp(props.modelValue + props.step))
}

function decrement(): void {
  if (props.disabled) {
    return
  }

  emit('update:modelValue', clamp(props.modelValue - props.step))
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-stepper-field {
  display: flex;
  align-items: stretch;
  gap: $spacing-2;
}

.editor-stepper-field__input {
  flex: 1;
  min-width: 0;

  :deep(.v-field) {
    border-radius: pp.$radius;
    --v-theme-primary: #{pp.$accent-rgb};
  }

  :deep(.v-field__outline) {
    color: pp.$border;
  }

  :deep(.v-field:hover .v-field__outline) {
    color: pp.$border-strong;
  }

  :deep(.v-field--focused .v-field__outline) {
    color: pp.$accent;
  }

  :deep(.v-field--focused) {
    box-shadow: 0 0 0 3px pp.$accent-glow;
    border-radius: pp.$radius;
  }
}

.editor-stepper-field--mini {
  .editor-stepper-field__input :deep(.v-field__input) {
    font-size: 12px;
  }
}

.editor-stepper-field__stepper {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 26px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
}

.editor-stepper-field__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: $white;
  color: pp.$ink-soft;
  cursor: pointer;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;

  &:first-child {
    border-bottom: 1px solid pp.$border;
  }

  &:hover:not(:disabled) {
    background: pp.$accent-tint;
    color: pp.$accent-deep;
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
}
</style>
