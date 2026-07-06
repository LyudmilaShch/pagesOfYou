<template>
  <div v-if="visible" class="editor-print-crop-warning" :style="badgeStyle">
    <span class="editor-print-crop-warning__label">Проблемная область</span>

    <v-tooltip location="bottom" max-width="280">
      <template #activator="{ props: tooltipProps }">
        <button
          type="button"
          class="editor-print-crop-warning__info"
          aria-label="Подсказка по зоне обрезки"
          v-bind="tooltipProps"
        >
          <v-icon size="14">mdi-information-outline</v-icon>
        </button>
      </template>

      Разместите элементы подальше от краев, чтобы избежать обрезки
    </v-tooltip>

    <button
      v-if="allowable"
      type="button"
      class="editor-print-crop-warning__allow"
      @click="emit('allow')"
    >
      Разрешить
    </button>

    <span class="editor-print-crop-warning__marker" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { PRINT_CROP_MARGIN } from '../../constants/page.constants'

const props = defineProps<{
  visible: boolean
  pageOffset: { x: number; y: number }
  pageScale: number
  pageWidth: number
  allowable?: boolean
}>()

const emit = defineEmits<{
  allow: []
}>()

const badgeStyle = computed(() => ({
  left: `${props.pageOffset.x + (props.pageWidth * props.pageScale) / 2}px`,
  top: `${props.pageOffset.y + PRINT_CROP_MARGIN * props.pageScale * 0.5}px`,
}))
</script>

<style scoped lang="scss">
.editor-print-crop-warning {
  position: absolute;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-1 $spacing-3;
  border-radius: 999px;
  background: #f44336;
  color: $text-inverse;
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.35);
  transform: translate(-50%, -100%);
  pointer-events: auto;
}

.editor-print-crop-warning__label {
  font-size: $font-size-caption;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.editor-print-crop-warning__info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  color: inherit;
  cursor: help;
}

.editor-print-crop-warning__allow {
  margin-left: $spacing-1;
  padding: 2px $spacing-2;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: inherit;
  font-size: $font-size-caption;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.28);
  }
}

.editor-print-crop-warning__marker {
  position: absolute;
  left: 50%;
  bottom: -5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f44336;
  transform: translateX(-50%);
}
</style>
