<template>
  <div class="editor-angle-field">
    <label class="editor-angle-field__box">
      <svg class="editor-angle-field__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 9a8 8 0 1 1 1.3 7.7" />
        <path d="M4 4v5h5" />
      </svg>
      <input
        type="number"
        :value="modelValue"
        :disabled="disabled"
        @change="onChange"
      />
      <span class="editor-angle-field__unit">°</span>
    </label>

    <div class="editor-angle-field__stepper">
      <button
        type="button"
        class="editor-angle-field__stepper-btn"
        tabindex="-1"
        aria-label="Увеличить на 1°"
        :disabled="disabled"
        @click="step(1)"
      >
        <v-icon size="10">mdi-chevron-up</v-icon>
      </button>
      <button
        type="button"
        class="editor-angle-field__stepper-btn"
        tabindex="-1"
        aria-label="Уменьшить на 1°"
        :disabled="disabled"
        @click="step(-1)"
      >
        <v-icon size="10">mdi-chevron-down</v-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onChange(event: Event): void {
  const parsed = Number((event.target as HTMLInputElement).value)
  emit('update:modelValue', Number.isFinite(parsed) ? parsed : props.modelValue)
}

function step(delta: number): void {
  if (props.disabled) {
    return
  }

  emit('update:modelValue', props.modelValue + delta)
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-angle-field {
  display: flex;
  align-items: stretch;
  gap: $spacing-2;
}

.editor-angle-field__box {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  cursor: text;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: pp.$border-strong;
  }

  &:focus-within {
    border-color: pp.$accent;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }
}

.editor-angle-field__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: pp.$ink-faint;
}

.editor-angle-field__box input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  font-size: 12.5px;
  font-family: inherit;
  color: pp.$ink;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }

  appearance: textfield;
  -moz-appearance: textfield;
}

.editor-angle-field__unit {
  flex-shrink: 0;
  font-size: 11px;
  color: pp.$ink-faint;
}

.editor-angle-field__stepper {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 26px;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  overflow: hidden;
}

.editor-angle-field__stepper-btn {
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
