<template>
  <div class="question-gallery-field">
    <div class="question-gallery-field__toolbar">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="question-gallery-field__file-input"
        @change="handleFilesSelected"
      />
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-tray-arrow-up"
        :loading="uploading"
        @click="fileInputRef?.click()"
      >
        Загрузить фото
      </v-btn>
      <span v-if="modelValue.length > 0" class="question-gallery-field__count">
        Выбрано: {{ modelValue.length }}
      </span>
    </div>

    <div v-if="loading" class="question-gallery-field__state">
      <v-progress-circular indeterminate color="primary" size="24" />
    </div>

    <div v-else-if="photos.length === 0" class="question-gallery-field__state">
      В галерее пока нет фото — загрузите первое
    </div>

    <div v-else class="question-gallery-field__grid">
      <button
        v-for="photo in photos"
        :key="photo.id"
        type="button"
        class="question-gallery-field__item"
        :class="{ 'question-gallery-field__item--selected': selectedIndex(photo.url) !== -1 }"
        @click="toggle(photo.url)"
      >
        <img :src="photo.url" :alt="photo.originalName ?? ''" />
        <span v-if="selectedIndex(photo.url) !== -1" class="question-gallery-field__badge">
          {{ selectedIndex(photo.url) + 1 }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { photoGalleryApi, type GalleryPhoto, type PhotoGalleryScope } from '../../api/photo-gallery.api'

const props = defineProps<{
  modelValue: string[]
  scope: PhotoGalleryScope
}>()

const emit = defineEmits<{
  'update:modelValue': [urls: string[]]
}>()

const photos = ref<GalleryPhoto[]>([])
const loading = ref(false)
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

function selectedIndex(url: string): number {
  return props.modelValue.indexOf(url)
}

function toggle(url: string): void {
  const index = selectedIndex(url)
  const next = [...props.modelValue]
  if (index === -1) {
    next.push(url)
  } else {
    next.splice(index, 1)
  }
  emit('update:modelValue', next)
}

async function loadPhotos(): Promise<void> {
  loading.value = true
  try {
    photos.value = await photoGalleryApi.list(props.scope)
  } catch {
    photos.value = []
  } finally {
    loading.value = false
  }
}

async function handleFilesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''

  if (files.length === 0) {
    return
  }

  uploading.value = true
  try {
    for (const file of files) {
      try {
        const dimensions = await getImageDimensions(file).catch(() => undefined)
        const uploaded = await photoGalleryApi.upload(props.scope, file, dimensions)
        photos.value = [uploaded, ...photos.value]
        emit('update:modelValue', [...props.modelValue, uploaded.url])
      } catch {
        // Best-effort per file — a failed upload just doesn't get added or selected.
      }
    }
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  void loadPhotos()
})
</script>

<style scoped lang="scss">
.question-gallery-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.question-gallery-field__toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-3;
}

.question-gallery-field__count {
  font-size: $font-size-caption;
  color: $text-secondary;
}

.question-gallery-field__file-input {
  display: none;
}

.question-gallery-field__state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-6;
  color: $text-muted;
  font-size: $font-size-body-sm;
}

.question-gallery-field__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: $spacing-2;
  max-height: 320px;
  overflow-y: auto;
}

.question-gallery-field__item {
  position: relative;
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: $radius-md;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  background: $bg-muted;

  &--selected {
    border-color: $text-primary;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.question-gallery-field__badge {
  position: absolute;
  top: 4px;
  left: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: $text-primary;
  color: $white;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
</style>
