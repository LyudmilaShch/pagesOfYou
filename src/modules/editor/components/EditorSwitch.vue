<template>
  <div class="editor-switch-row">
    <span v-if="label" class="editor-switch-row__label">{{ label }}</span>

    <button
      type="button"
      class="editor-switch"
      :class="{ 'editor-switch--on': modelValue }"
      role="switch"
      :aria-checked="modelValue"
      :aria-label="label"
      :disabled="disabled"
      @click="toggle"
    >
      <span class="editor-switch__dot" />
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label?: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle(): void {
  if (props.disabled) {
    return
  }

  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-2;
}

.editor-switch-row__label {
  font-size: 13px;
  color: pp.$ink;
}

.editor-switch {
  flex-shrink: 0;
  width: 34px;
  height: 19px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: pp.$border-strong;
  position: relative;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: pp.$ink-faint;
  }

  &--on {
    background: pp.$accent;

    &:hover:not(:disabled) {
      background: pp.$accent-deep;
    }
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px pp.$accent-glow;
  }
}

.editor-switch__dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: $white;
  transition: left 0.18s cubic-bezier(0.4, 0, 0.2, 1);

  .editor-switch--on & {
    left: 17px;
  }
}
</style>
