<template>
  <aside class="admin-photo-gallery" aria-label="Галерея фото">
    <div class="admin-photo-gallery__header">
      <p class="admin-photo-gallery__eyebrow">Галерея</p>
      <h2 class="admin-photo-gallery__title">Фото журнала</h2>
      <p class="admin-photo-gallery__hint">{{ photos.length }} фото</p>
    </div>

    <div class="admin-photo-gallery__upload">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="admin-photo-gallery__file-input"
        @change="handleFilesSelected"
      />
      <v-btn
        block
        variant="outlined"
        size="small"
        prepend-icon="mdi-tray-arrow-up"
        :loading="uploading"
        @click="triggerFileInput"
      >
        Загрузить фото
      </v-btn>
      <p v-if="uploading" class="admin-photo-gallery__upload-progress">
        Загружено {{ uploadedCount }} из {{ uploadTotal }}
      </p>
    </div>

    <div v-if="loading" class="admin-photo-gallery__state">
      <v-progress-circular indeterminate color="primary" size="28" />
    </div>

    <div v-else-if="photos.length === 0" class="admin-photo-gallery__state">
      <v-icon size="28" color="grey">mdi-image-multiple-outline</v-icon>
      <p>Пока нет фото</p>
    </div>

    <div v-else class="admin-photo-gallery__grid">
      <div v-for="photo in photos" :key="photo.id" class="admin-photo-gallery__item">
        <img :src="photo.url" :alt="photo.originalName ?? ''" class="admin-photo-gallery__thumb" />

        <button
          type="button"
          class="admin-photo-gallery__favorite"
          :class="{ 'admin-photo-gallery__favorite--active': photo.isFavorite }"
          :aria-label="photo.isFavorite ? 'Убрать из избранного' : 'В избранное'"
          @click="toggleFavorite(photo)"
        >
          <v-icon size="16">{{ photo.isFavorite ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
        </button>

        <button
          type="button"
          class="admin-photo-gallery__delete"
          aria-label="Удалить фото"
          @click="removePhoto(photo)"
        >
          <v-icon size="16">mdi-trash-can-outline</v-icon>
        </button>
      </div>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom center" :timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { adminPhotoGalleryApi, type GalleryPhoto } from '@/shared/api/admin/photo-gallery.api'

const route = useRoute()
const orderId = computed(() => route.params.orderId as string)

const photos = ref<GalleryPhoto[]>([])
const loading = ref(false)
const uploading = ref(false)
const uploadedCount = ref(0)
const uploadTotal = ref(0)
const fileInputRef = ref<HTMLInputElement | null>(null)

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

async function loadPhotos(): Promise<void> {
  loading.value = true
  try {
    photos.value = await adminPhotoGalleryApi.list(orderId.value)
  } catch {
    snackbar.text = 'Не удалось загрузить галерею'
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    loading.value = false
  }
}

function triggerFileInput(): void {
  fileInputRef.value?.click()
}

async function handleFilesSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''

  if (files.length === 0) {
    return
  }

  uploading.value = true
  uploadTotal.value = files.length
  uploadedCount.value = 0
  let failedCount = 0

  try {
    for (const file of files) {
      try {
        const dimensions = await getImageDimensions(file).catch(() => undefined)
        const uploaded = await adminPhotoGalleryApi.upload(orderId.value, file, dimensions)
        photos.value = [uploaded, ...photos.value]
      } catch {
        failedCount += 1
      } finally {
        uploadedCount.value += 1
      }
    }
  } finally {
    uploading.value = false
  }

  if (failedCount > 0) {
    snackbar.text = `Не удалось загрузить ${failedCount} из ${files.length} фото`
    snackbar.color = 'error'
    snackbar.show = true
  }
}

async function toggleFavorite(photo: GalleryPhoto): Promise<void> {
  try {
    const updated = await adminPhotoGalleryApi.setFavorite(orderId.value, photo.id, !photo.isFavorite)
    const index = photos.value.findIndex((item) => item.id === photo.id)
    if (index !== -1) {
      photos.value[index] = updated
    }
  } catch {
    snackbar.text = 'Не удалось обновить избранное'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

async function removePhoto(photo: GalleryPhoto): Promise<void> {
  if (!window.confirm('Удалить фото из галереи?')) {
    return
  }

  try {
    await adminPhotoGalleryApi.remove(orderId.value, photo.id)
    photos.value = photos.value.filter((item) => item.id !== photo.id)
  } catch {
    snackbar.text = 'Не удалось удалить фото'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

onMounted(loadPhotos)
</script>

<style scoped lang="scss">
.admin-photo-gallery {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.admin-photo-gallery__header {
  padding: $spacing-4 $spacing-4 $spacing-3;
  border-bottom: 1px solid $border-light;
}

.admin-photo-gallery__eyebrow {
  margin: 0 0 2px;
  font-size: $font-size-caption;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: $letter-spacing-caption;
}

.admin-photo-gallery__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
}

.admin-photo-gallery__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.admin-photo-gallery__upload {
  padding: $spacing-3 $spacing-4;
  border-bottom: 1px solid $border-light;
}

.admin-photo-gallery__file-input {
  display: none;
}

.admin-photo-gallery__upload-progress {
  margin: $spacing-2 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
  text-align: center;
}

.admin-photo-gallery__state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  padding: $spacing-8 $spacing-4;
  color: $text-muted;
  text-align: center;
  font-size: $font-size-body-sm;
}

.admin-photo-gallery__grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-2;
  padding: $spacing-3 $spacing-4;
  align-content: start;
}

.admin-photo-gallery__item {
  position: relative;
  aspect-ratio: 1;
  border-radius: $radius-md;
  overflow: hidden;
  border: 1px solid $border-light;
  background: $bg-muted;
}

.admin-photo-gallery__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.admin-photo-gallery__favorite,
.admin-photo-gallery__delete {
  position: absolute;
  top: $spacing-1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: $white;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
  }
}

.admin-photo-gallery__favorite {
  left: $spacing-1;

  &--active {
    color: #f5c518;
  }
}

.admin-photo-gallery__delete {
  right: $spacing-1;
}
</style>
