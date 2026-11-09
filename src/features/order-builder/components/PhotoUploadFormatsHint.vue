<template>
  <p class="photo-upload-formats-hint">{{ hint }}</p>
</template>

<script setup lang="ts">
import { getPhotoUploadHint } from '@/shared/constants/photo-upload.constants'

const hint = getPhotoUploadHint()
</script>

<style scoped lang="scss">
.photo-upload-formats-hint {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: $spacing-3 0 0;
  font-size: $font-size-caption;
  line-height: 1.45;
  color: $text-secondary;
  text-align: center;

  @include mobile-only {
    text-align: left;
  }
}
</style>
