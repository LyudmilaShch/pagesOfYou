<template>
  <div
    class="print-resolution-tip"
    :style="{ left: `${x}px`, top: `${y}px` }"
    role="tooltip"
  >
    {{ message }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  x: number
  y: number
  message: string
}>()
</script>

<style scoped lang="scss">
.print-resolution-tip {
  position: fixed;
  z-index: 40;
  max-width: 280px;
  padding: 6px 10px;
  border-radius: 4px;
  background: $black;
  color: $white;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.4;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 12px));
}
</style>
