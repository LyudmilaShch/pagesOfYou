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
          <p>В галерее пока нет фото</p>
        </div>

        <div v-else class="photo-gallery-picker__grid">
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
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

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
  gap: $spacing-2;
  padding: $spacing-8 $spacing-4;
  color: $text-muted;
  text-align: center;
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
</style>
