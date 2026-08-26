<template>
  <div class="editor-effect-descriptor-form">
    <template v-for="field in fields" :key="field.key">
      <EditorColorPicker
        v-if="field.kind === 'color'"
        :label="field.label"
        :model-value="String(params[field.key] ?? '#111111')"
        fallback="#111111"
        @update:model-value="emitPatch(field.key, $event)"
      />

      <div v-else class="editor-effect-descriptor-form__row">
        <span class="editor-effect-descriptor-form__row-label">{{ field.label }}</span>
        <div class="editor-effect-descriptor-form__row-control">
          <v-slider
            :model-value="getNumberValue(field.key)"
            :min="field.min ?? 0"
            :max="field.max ?? 100"
            :step="field.step ?? 1"
            color="primary"
            hide-details
            @update:model-value="emitPatch(field.key, Number($event))"
          />
          <v-text-field
            :model-value="getNumberValue(field.key)"
            type="number"
            :min="field.min ?? 0"
            :max="field.max ?? 100"
            :step="field.step ?? 1"
            density="compact"
            variant="outlined"
            hide-details
            class="editor-effect-descriptor-form__row-input"
            @update:model-value="emitPatch(field.key, toNumber($event, getNumberValue(field.key)))"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { EffectFieldDef } from '../../models/effect-descriptor.model'
import EditorColorPicker from '../EditorColorPicker.vue'

const props = defineProps<{
  fields: EffectFieldDef[]
  params: Record<string, number | string>
}>()

const emit = defineEmits<{
  patch: [patch: Record<string, number | string>]
}>()

function getNumberValue(key: string): number {
  const value = props.params[key]
  return typeof value === 'number' ? value : 0
}

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function emitPatch(key: string, value: number | string): void {
  emit('patch', { [key]: value })
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-effect-descriptor-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.editor-effect-descriptor-form__row {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.editor-effect-descriptor-form__row-label {
  font-size: $font-size-body-sm;
  color: pp.$ink-soft;
}

.editor-effect-descriptor-form__row-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px;
  gap: $spacing-2;
  align-items: center;

  // See the matching note in EditorEffectSettingsForm.vue — color="primary" alone renders black
  // because Vuetify's .v-theme--light class re-declares the theme variables on the component
  // itself, beating an inherited override.
  :deep(.v-slider-track__fill) {
    background-color: pp.$accent !important;
  }

  :deep(.v-slider-thumb__surface) {
    color: pp.$accent !important;
  }
}

.editor-effect-descriptor-form__row-input {
  :deep(.v-field) {
    font-size: $font-size-body-sm;
  }
}
</style>
