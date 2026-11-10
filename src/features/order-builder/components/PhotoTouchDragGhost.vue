<template>
  <Teleport to="body">
    <div
      v-if="drag"
      class="photo-touch-drag-ghost"
      :style="{ left: `${drag.x}px`, top: `${drag.y}px` }"
    >
      <img :src="drag.url" alt="" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { PhotoTouchDrag } from '../composables/use-photo-touch-drag'

defineProps<{
  drag: PhotoTouchDrag | null
}>()
</script>

<style lang="scss">
.photo-touch-drag-ghost {
  position: fixed;
  z-index: 2700;
  width: 64px;
  height: 64px;
  pointer-events: none;
  border-radius: $radius-md;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba($black, 0.28);
  transform: translate(-50%, -50%) scale(1.08);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}
</style>
