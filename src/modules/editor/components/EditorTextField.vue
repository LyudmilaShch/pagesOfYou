<template>
  <div class="editor-text-field">
    <span v-if="label" class="editor-text-field__label">{{ label }}</span>

    <textarea
      v-if="multiline"
      class="editor-text-field__control editor-text-field__control--multiline"
      :value="modelValue"
      :rows="rows"
      :disabled="disabled"
      :placeholder="placeholder"
      @change="onChange"
    />
    <input
      v-else
      type="text"
      class="editor-text-field__control"
      :value="modelValue"
      :disabled="disabled"
      :placeholder="placeholder"
      @change="onChange"
    />

    <p v-if="hint" class="editor-text-field__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    hint?: string
    placeholder?: string
    disabled?: boolean
    multiline?: boolean
    rows?: number
  }>(),
  {
    rows: 2,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-text-field {
  display: flex;
  flex-direction: column;
}

.editor-text-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: $font-weight-medium;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: pp.$ink-soft;
}

.editor-text-field__control {
  width: 100%;
  border: 1px solid pp.$border;
  border-radius: pp.$radius;
  background: transparent;
  color: pp.$ink;
  font-family: inherit;
  font-size: 13px;
  padding: 9px 11px;
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

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.editor-text-field__control--multiline {
  resize: vertical;
  min-height: 64px;
  line-height: 1.4;
}

.editor-text-field__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: pp.$ink-faint;
}
</style>
