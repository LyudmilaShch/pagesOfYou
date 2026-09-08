<template>
  <aside class="photo-gallery" aria-label="Галерея фото">
    <div class="photo-gallery__header">
      <p class="photo-gallery__eyebrow">Галерея</p>
      <h2 class="photo-gallery__title">Фото журнала</h2>
      <p class="photo-gallery__hint">{{ photos.length }} фото</p>
    </div>

    <div class="photo-gallery__upload">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        class="photo-gallery__file-input"
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
      <p v-if="uploading" class="photo-gallery__upload-progress">
        Загружено {{ uploadedCount }} из {{ uploadTotal }}
      </p>

      <v-btn
        block
        color="primary"
        size="small"
        prepend-icon="mdi-auto-fix"
        class="photo-gallery__auto-fill"
        :loading="autoFilling"
        :disabled="photos.length === 0"
        @click="handleAutoFill"
      >
        Автозаполнение журнала
      </v-btn>
    </div>

    <div v-if="loading" class="photo-gallery__state">
      <v-progress-circular indeterminate color="primary" size="28" />
    </div>

    <div v-else-if="photos.length === 0" class="photo-gallery__state">
      <v-icon size="28" color="grey">mdi-image-multiple-outline</v-icon>
      <p>Пока нет фото — загрузите с устройства</p>
    </div>

    <div v-else class="photo-gallery__grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-gallery__item">
        <img :src="photo.url" :alt="photo.originalName ?? ''" class="photo-gallery__thumb" />

        <button
          type="button"
          class="photo-gallery__favorite"
          :class="{ 'photo-gallery__favorite--active': photo.isFavorite }"
          :aria-label="photo.isFavorite ? 'Убрать из избранного' : 'В избранное'"
          @click="toggleFavorite(photo)"
        >
          <v-icon size="16">{{ photo.isFavorite ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
        </button>

        <button
          type="button"
          class="photo-gallery__delete"
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

import { useEditorStore } from '@/modules/editor/store/editor.store'
import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import { photoGalleryApi, type GalleryPhoto } from '../api/photo-gallery.api'
import { ordersApi } from '../api/orders.api'
import { getGalleryScope } from '../utils/photo-gallery-scope.util'
import { applyAutoFillToJournalPages } from '../utils/auto-fill-photos.util'

const route = useRoute()
const store = useOrderBuilderStore()
const editorStore = useEditorStore()

const scope = computed(() => getGalleryScope(store))

const photos = ref<GalleryPhoto[]>([])
const loading = ref(false)
const uploading = ref(false)
const uploadedCount = ref(0)
const uploadTotal = ref(0)
const autoFilling = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const snackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

async function loadPhotos(): Promise<void> {
  loading.value = true
  try {
    photos.value = await photoGalleryApi.list(scope.value)
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
        const uploaded = await photoGalleryApi.upload(scope.value, file, dimensions)
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
    const updated = await photoGalleryApi.setFavorite(photo.id, scope.value, !photo.isFavorite)
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
    await photoGalleryApi.remove(photo.id, scope.value)
    photos.value = photos.value.filter((item) => item.id !== photo.id)
  } catch {
    snackbar.text = 'Не удалось удалить фото'
    snackbar.color = 'error'
    snackbar.show = true
  }
}

/** Applies a page's auto-fill result to the *currently open* editor document in place — updating
 * `orderBuilderStore` alone wouldn't touch the live canvas, since the editor already holds its
 * own materialized copy. Marks the document dirty; the editor's own autosave (or the explicit
 * `saveCanvas()` below, for an immediate result) persists it exactly like a manual edit would. */
function applyAssignmentsToLiveEditor(assignments: Map<string, string>): void {
  for (const [elementId, url] of assignments) {
    editorStore.updateElement(elementId, {
      defaultImageUrl: url,
      cropX: 0,
      cropY: 0,
      imageScale: 1,
    })
  }
}

async function handleAutoFill(): Promise<void> {
  if (!store.order) {
    return
  }

  autoFilling.value = true

  try {
    if (editorStore.isDirty) {
      await editorStore.saveCanvas()
    }

    const result = applyAutoFillToJournalPages(store.order.journalPages, photos.value)

    if (result.changedPages.length === 0) {
      snackbar.text =
        result.remainingEmptyCount > 0
          ? 'Не нашлось подходящих фото для пустых мест'
          : 'В журнале нет пустых мест для фото'
      snackbar.color = 'success'
      snackbar.show = true
      return
    }

    const currentJournalPageId = route.params.journalPageId as string | undefined
    const saveRequests: Promise<unknown>[] = []

    for (const changed of result.changedPages) {
      store.applyJournalPageCanvasEdit(changed.journalPageId, changed.canvasData)

      const isCurrentlyOpen =
        changed.journalPageId === currentJournalPageId &&
        editorStore.document?.id === changed.journalPageId

      if (isCurrentlyOpen) {
        applyAssignmentsToLiveEditor(changed.assignments)
        if (!store.isLocalDraft) {
          saveRequests.push(editorStore.saveCanvas())
        }
        continue
      }

      if (!store.isLocalDraft) {
        saveRequests.push(
          ordersApi.saveJournalPageCanvas(store.order.id, changed.journalPageId, changed.canvasData),
        )
      }
    }

    const outcomes = await Promise.allSettled(saveRequests)
    const failedCount = outcomes.filter((outcome) => outcome.status === 'rejected').length

    if (failedCount > 0) {
      snackbar.text = `Автозаполнение применено, но ${failedCount} стр. не удалось сохранить — попробуйте ещё раз`
      snackbar.color = 'error'
    } else if (result.remainingEmptyCount > 0) {
      snackbar.text = `Заполнено ${result.filledCount} — не хватило фото ещё для ${result.remainingEmptyCount} мест`
      snackbar.color = 'success'
    } else {
      snackbar.text = 'Журнал автоматически заполнен'
      snackbar.color = 'success'
    }
    snackbar.show = true
  } catch {
    snackbar.text = 'Не удалось выполнить автозаполнение'
    snackbar.color = 'error'
    snackbar.show = true
  } finally {
    autoFilling.value = false
  }
}

onMounted(loadPhotos)
</script>

<style scoped lang="scss">
.photo-gallery {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.photo-gallery__header {
  padding: $spacing-4 $spacing-4 $spacing-3;
  border-bottom: 1px solid $border-light;
}

.photo-gallery__eyebrow {
  margin: 0 0 2px;
  font-size: $font-size-caption;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: $letter-spacing-caption;
}

.photo-gallery__title {
  margin: 0;
  font-family: $font-family-display;
  font-size: $font-size-body-lg;
  color: $text-primary;
}

.photo-gallery__hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.photo-gallery__upload {
  padding: $spacing-3 $spacing-4;
  border-bottom: 1px solid $border-light;
}

.photo-gallery__file-input {
  display: none;
}

.photo-gallery__upload-progress {
  margin: $spacing-2 0 0;
  font-size: $font-size-caption;
  color: $text-muted;
  text-align: center;
}

.photo-gallery__auto-fill {
  margin-top: $spacing-2;
}

.photo-gallery__state {
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

.photo-gallery__grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-2;
  padding: $spacing-3 $spacing-4;
  align-content: start;
}

.photo-gallery__item {
  position: relative;
  aspect-ratio: 1;
  border-radius: $radius-md;
  overflow: hidden;
  border: 1px solid $border-light;
  background: $bg-muted;
}

.photo-gallery__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-gallery__favorite,
.photo-gallery__delete {
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

.photo-gallery__favorite {
  left: $spacing-1;

  &--active {
    color: #f5c518;
  }
}

.photo-gallery__delete {
  right: $spacing-1;
}
</style>
