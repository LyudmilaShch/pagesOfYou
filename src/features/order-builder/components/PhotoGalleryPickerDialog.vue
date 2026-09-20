<template>
  <v-dialog :model-value="open" max-width="640" @update:model-value="handleModelUpdate">
    <v-card>
      <v-card-title class="photo-gallery-picker__title">
        Выбрать из галереи
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Закрыть" @click="emit('close')" />
      </v-card-title>

      <v-card-text>
        <div v-if="loading" class="photo-gallery-picker__state">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <div v-else-if="photos.length === 0" class="photo-gallery-picker__state">
          <v-icon size="28" color="grey">mdi-image-multiple-outline</v-icon>
          <p>Загруженных фото нет</p>
          <v-btn color="primary" variant="flat" :loading="uploading" @click="fileInputRef?.click()">
            Загрузить фото
          </v-btn>
        </div>

        <div v-else class="photo-gallery-picker__grid">
          <button
            type="button"
            class="photo-gallery-picker__item photo-gallery-picker__item--upload"
            aria-label="Загрузить фото"
            :disabled="uploading"
            @click="fileInputRef?.click()"
          >
            <v-progress-circular v-if="uploading" indeterminate size="20" width="2" color="primary" />
            <v-icon v-else size="26" color="primary">mdi-plus</v-icon>
          </button>
          <button
            v-for="photo in photos"
            :key="photo.id"
            type="button"
            class="photo-gallery-picker__item"
            @click="emit('select', photo.url)"
          >
            <img :src="photo.url" :alt="photo.originalName ?? ''" />
          </button>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="photo-gallery-picker__file-input"
          @change="handleFilesSelected"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { photoGalleryApi, type GalleryPhoto, type PhotoGalleryScope } from '../api/photo-gallery.api'

const props = defineProps<{
  open: boolean
  scope: PhotoGalleryScope
}>()

const emit = defineEmits<{
  close: []
  select: [url: string]
}>()

const photos = ref<GalleryPhoto[]>([])
const loading = ref(false)
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

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

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void loadPhotos()
    }
  },
)

function handleModelUpdate(value: boolean): void {
  if (!value) {
    emit('close')
  }
}

/** Lets the empty state ("Загруженных фото нет") add photos without closing the picker first —
 * uploaded photos land in `photos` and the user then picks one the same way as any other, they
 * aren't auto-selected. */
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
      } catch {
        // Best-effort per file — a failed upload just doesn't get added.
      }
    }
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped lang="scss">
.photo-gallery-picker__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.photo-gallery-picker__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-3;
  padding: $spacing-8 $spacing-4;
  color: $text-muted;
  text-align: center;
}

.photo-gallery-picker__file-input {
  display: none;
}

.photo-gallery-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $spacing-2;
  max-height: 60vh;
  overflow-y: auto;
}

.photo-gallery-picker__item {
  aspect-ratio: 1;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  background: $bg-muted;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: $text-primary;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.photo-gallery-picker__item--upload {
  display: flex;
  align-items: center;
  justify-content: center;
  border-style: dashed;
  background: $bg-elevated;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}
</style>
