<template>
  <v-tooltip
    location="top"
    max-width="280"
    content-class="editor-tooltip--arrow-top"
  >
    <template #activator="{ props: tooltipProps }">
      <span
        v-bind="tooltipProps"
        class="print-resolution-badge"
        :class="`print-resolution-badge--${level}`"
        :style="{ background: PRINT_RESOLUTION_COLOR[level] }"
        :aria-label="message"
      >
        <v-icon :size="iconSize" color="white">mdi-alert</v-icon>
      </span>
    </template>
    {{ message }}
  </v-tooltip>
</template>

<script setup lang="ts">
/**
 * Same circle, icon, and colors as WOW-35's badge (`PrintResolutionBadge.vue` on that branch).
 * Colors live here until that branch's `print-resolution.util.ts` lands; the template and class
 * names match so the two copies can be dropped together.
 */
const PRINT_RESOLUTION_COLOR = {
  poor: '#d4532b',
  soft: '#e0a106',
} as const

withDefaults(
  defineProps<{
    level: 'soft' | 'poor'
    message: string
    iconSize?: number
  }>(),
  { iconSize: 12 },
)
</script>

<style scoped lang="scss">
.print-resolution-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
  cursor: help;
}
</style>
