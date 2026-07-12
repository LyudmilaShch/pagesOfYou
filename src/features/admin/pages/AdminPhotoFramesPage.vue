<template>
  <div class="photo-frames-page">
    <div class="photo-frames-page__inner">
      <div class="photo-frames-page__header">
        <div>
          <p class="photo-frames-page__eyebrow text-caption text-secondary">Библиотека</p>
          <h1 class="photo-frames-page__title">Фоторамки</h1>
          <p class="photo-frames-page__subtitle">
            Декоративные рамки для фото-плейсхолдера. Доступны в редакторе страниц в разделе «Фото».
          </p>
        </div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
          Добавить рамку
        </v-btn>
      </div>

      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

      <div v-if="!loading && frames.length === 0" class="photo-frames-page__empty">
        <v-icon size="40" color="textDisabled">mdi-image-frame</v-icon>
        <p>Рамок пока нет</p>
        <span>Добавьте первую декоративную рамку</span>
      </div>

      <div v-else class="photo-frames-page__list">
        <div
          v-for="frame in frames"
          :key="frame.id"
          class="photo-frames-page__item"
          :class="{ 'photo-frames-page__item--dragging': draggingId === frame.id }"
          draggable="true"
          @dragstart="onDragStart(frame.id)"
          @dragover.prevent
          @drop="onDrop(frame.id)"
          @dragend="draggingId = null"
        >
          <div class="photo-frames-page__drag" aria-hidden="true">
            <v-icon size="18">mdi-drag-vertical</v-icon>
          </div>

          <div class="photo-frames-page__preview">
            <img :src="frame.imageUrl" :alt="frame.name" />
          </div>

          <div class="photo-frames-page__meta">
            <span class="photo-frames-page__name">{{ frame.name }}</span>
            <span class="photo-frames-page__dims">{{ frame.naturalWidth }}×{{ frame.naturalHeight }}px</span>
          </div>

          <v-switch
            :model-value="frame.isActive"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="toggleActive(frame, Boolean($event))"
          />

          <div class="photo-frames-page__actions">
            <v-btn
              icon="mdi-pencil-outline"
              size="small"
              variant="text"
              aria-label="Изменить"
              @click="openEdit(frame)"
            />
            <v-btn
              icon="mdi-delete-outline"
              size="small"
              variant="text"
              color="error"
              aria-label="Удалить"
              @click="openDelete(frame)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- ══ Create / Edit dialog ═══════════════════════════════════════════ -->
    <v-dialog v-model="formDialog.open" max-width="520" scrollable>
      <v-card>
        <v-card-title>{{ formDialog.editId ? 'Редактировать рамку' : 'Новая рамка' }}</v-card-title>
        <v-divider />
        <v-card-text>
          <div class="photo-frames-form">
            <ImageUploader v-model="form.imageUrl" />

            <div v-if="form.imageUrl" class="photo-frames-form__preview-wrap">
              <div class="photo-frames-form__preview">
                <img :src="form.imageUrl" alt="Рамка" />
                <div
                  v-if="form.naturalWidth && form.naturalHeight"
                  class="photo-frames-form__guide photo-frames-form__guide--top"
                  :style="{ top: guidePercent(form.sliceTop, form.naturalHeight) }"
                />
                <div
                  v-if="form.naturalWidth && form.naturalHeight"
                  class="photo-frames-form__guide photo-frames-form__guide--bottom"
                  :style="{ bottom: guidePercent(form.sliceBottom, form.naturalHeight) }"
                />
                <div
                  v-if="form.naturalWidth && form.naturalHeight"
                  class="photo-frames-form__guide photo-frames-form__guide--left photo-frames-form__guide--vertical"
                  :style="{ left: guidePercent(form.sliceLeft, form.naturalWidth) }"
                />
                <div
                  v-if="form.naturalWidth && form.naturalHeight"
                  class="photo-frames-form__guide photo-frames-form__guide--right photo-frames-form__guide--vertical"
                  :style="{ right: guidePercent(form.sliceRight, form.naturalWidth) }"
                />
                <div
                  v-if="form.naturalWidth && form.naturalHeight"
                  class="photo-frames-form__area"
                  :style="{
                    top: guidePercent(form.photoAreaTop, form.naturalHeight),
                    right: guidePercent(form.photoAreaRight, form.naturalWidth),
                    bottom: guidePercent(form.photoAreaBottom, form.naturalHeight),
                    left: guidePercent(form.photoAreaLeft, form.naturalWidth),
                  }"
                />
              </div>
            </div>

            <p v-if="form.naturalWidth && form.naturalHeight" class="photo-frames-form__dims">
              Исходный размер: {{ form.naturalWidth }}×{{ form.naturalHeight }}px
            </p>

            <v-text-field v-model="form.name" label="Название *" variant="outlined" hide-details="auto" />

            <p class="photo-frames-form__section-label">
              Отступы рамки (px исходного изображения) — область внутри не растягивается по углам
            </p>
            <div class="photo-frames-form__slices">
              <v-text-field
                v-model.number="form.sliceTop"
                label="Сверху"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.sliceRight"
                label="Справа"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.sliceBottom"
                label="Снизу"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.sliceLeft"
                label="Слева"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
            </div>

            <p class="photo-frames-form__section-label">
              Область фото (px исходного изображения) — где именно показывается фото пользователя.
              Если оставить равной отступам рамки — фото займёт всю растяжимую середину.
            </p>
            <div class="photo-frames-form__slices">
              <v-text-field
                v-model.number="form.photoAreaTop"
                label="Сверху"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.photoAreaRight"
                label="Справа"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.photoAreaBottom"
                label="Снизу"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model.number="form.photoAreaLeft"
                label="Слева"
                type="number"
                min="0"
                variant="outlined"
                density="compact"
                hide-details
              />
            </div>

            <v-switch v-model="form.isActive" label="Активна" color="primary" hide-details />
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="formDialog.open = false">Отмена</v-btn>
          <v-btn color="primary" :loading="formDialog.submitting" :disabled="!canSubmit" @click="submitForm">
            {{ formDialog.editId ? 'Сохранить' : 'Создать' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ Delete confirmation ════════════════════════════════════════════ -->
    <v-dialog v-model="deleteDialog.open" max-width="420">
      <v-card>
        <v-card-title>Удалить рамку?</v-card-title>
        <v-card-text>Рамка «{{ deleteDialog.name }}» будет скрыта и больше не появится в редакторе.</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialog.open = false">Отмена</v-btn>
          <v-btn color="error" :loading="deleteDialog.loading" @click="confirmDelete">Удалить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom right" :timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'

import ImageUploader from '@/components/ImageUploader.vue'
import { loadHtmlImage } from '@/modules/editor/utils/load-image.util'
import {
  adminPhotoFramesApi,
  type AdminPhotoFrame,
} from '@/shared/api/admin/photo-frames.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'

const frames = ref<AdminPhotoFrame[]>([])
const loading = ref(false)
const draggingId = ref<string | null>(null)

const snackbar = reactive({ show: false, text: '', color: 'success' as string })

function notify(text: string, color = 'success'): void {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

async function loadFrames(): Promise<void> {
  loading.value = true
  try {
    frames.value = await adminPhotoFramesApi.list()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось загрузить рамки'), 'error')
  } finally {
    loading.value = false
  }
}

// ── Form dialog ──────────────────────────────────────────────────────────────

const emptyForm = () => ({
  name: '',
  imageUrl: null as string | null,
  naturalWidth: 0,
  naturalHeight: 0,
  sliceTop: 0,
  sliceRight: 0,
  sliceBottom: 0,
  sliceLeft: 0,
  photoAreaTop: 0,
  photoAreaRight: 0,
  photoAreaBottom: 0,
  photoAreaLeft: 0,
  isActive: true,
})

const form = reactive(emptyForm())
const formDialog = reactive({ open: false, editId: null as string | null, submitting: false })

const canSubmit = ref(false)
watch(
  () => [form.name, form.imageUrl, form.naturalWidth, form.naturalHeight],
  () => {
    canSubmit.value = Boolean(form.name.trim() && form.imageUrl && form.naturalWidth && form.naturalHeight)
  },
  { immediate: true },
)

watch(
  () => form.imageUrl,
  async (url) => {
    if (!url) {
      form.naturalWidth = 0
      form.naturalHeight = 0
      return
    }

    try {
      const image = await loadHtmlImage(url)
      form.naturalWidth = image.naturalWidth
      form.naturalHeight = image.naturalHeight
    } catch {
      form.naturalWidth = 0
      form.naturalHeight = 0
    }
  },
)

function guidePercent(sliceValue: number, natural: number): string {
  if (!natural) {
    return '0%'
  }
  return `${Math.min(100, Math.max(0, (sliceValue / natural) * 100))}%`
}

function openCreate(): void {
  formDialog.editId = null
  Object.assign(form, emptyForm())
  formDialog.open = true
}

function openEdit(frame: AdminPhotoFrame): void {
  formDialog.editId = frame.id
  Object.assign(form, {
    name: frame.name,
    imageUrl: frame.imageUrl,
    naturalWidth: frame.naturalWidth,
    naturalHeight: frame.naturalHeight,
    sliceTop: frame.sliceTop,
    sliceRight: frame.sliceRight,
    sliceBottom: frame.sliceBottom,
    sliceLeft: frame.sliceLeft,
    photoAreaTop: frame.photoAreaTop,
    photoAreaRight: frame.photoAreaRight,
    photoAreaBottom: frame.photoAreaBottom,
    photoAreaLeft: frame.photoAreaLeft,
    isActive: frame.isActive,
  })
  formDialog.open = true
}

async function submitForm(): Promise<void> {
  if (!canSubmit.value || !form.imageUrl) {
    return
  }

  formDialog.submitting = true
  try {
    const payload = {
      name: form.name.trim(),
      imageUrl: form.imageUrl,
      naturalWidth: form.naturalWidth,
      naturalHeight: form.naturalHeight,
      sliceTop: form.sliceTop,
      sliceRight: form.sliceRight,
      sliceBottom: form.sliceBottom,
      sliceLeft: form.sliceLeft,
      photoAreaTop: form.photoAreaTop,
      photoAreaRight: form.photoAreaRight,
      photoAreaBottom: form.photoAreaBottom,
      photoAreaLeft: form.photoAreaLeft,
      isActive: form.isActive,
    }

    if (formDialog.editId) {
      await adminPhotoFramesApi.update(formDialog.editId, payload)
      notify('Рамка обновлена')
    } else {
      await adminPhotoFramesApi.create(payload)
      notify('Рамка создана')
    }

    formDialog.open = false
    await loadFrames()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось сохранить рамку'), 'error')
  } finally {
    formDialog.submitting = false
  }
}

async function toggleActive(frame: AdminPhotoFrame, isActive: boolean): Promise<void> {
  try {
    await adminPhotoFramesApi.update(frame.id, { isActive })
    frame.isActive = isActive
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось изменить статус рамки'), 'error')
  }
}

// ── Delete dialog ────────────────────────────────────────────────────────────

const deleteDialog = reactive({ open: false, id: null as string | null, name: '', loading: false })

function openDelete(frame: AdminPhotoFrame): void {
  deleteDialog.id = frame.id
  deleteDialog.name = frame.name
  deleteDialog.open = true
}

async function confirmDelete(): Promise<void> {
  if (!deleteDialog.id) {
    return
  }

  deleteDialog.loading = true
  try {
    await adminPhotoFramesApi.remove(deleteDialog.id)
    deleteDialog.open = false
    notify('Рамка удалена')
    await loadFrames()
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось удалить рамку'), 'error')
  } finally {
    deleteDialog.loading = false
  }
}

// ── Reorder ──────────────────────────────────────────────────────────────────

function onDragStart(id: string): void {
  draggingId.value = id
}

async function onDrop(targetId: string): Promise<void> {
  const sourceId = draggingId.value
  if (!sourceId || sourceId === targetId) {
    return
  }

  const reordered = [...frames.value]
  const fromIndex = reordered.findIndex((frame) => frame.id === sourceId)
  const toIndex = reordered.findIndex((frame) => frame.id === targetId)

  if (fromIndex === -1 || toIndex === -1) {
    return
  }

  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  frames.value = reordered.map((frame, index) => ({ ...frame, sortOrder: index }))

  try {
    await adminPhotoFramesApi.reorder({
      items: frames.value.map((frame, index) => ({ id: frame.id, sortOrder: index })),
    })
  } catch (err) {
    notify(extractApiErrorMessage(err, 'Не удалось изменить порядок'), 'error')
    await loadFrames()
  }
}

onMounted(() => {
  void loadFrames()
})
</script>

<style scoped lang="scss">
.photo-frames-page {
  min-height: 100%;
}

.photo-frames-page__inner {
  @include page-container;
  max-width: 900px;
  margin-inline: auto;
  padding-block: $spacing-8 $spacing-16;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.photo-frames-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: $spacing-4;
}

.photo-frames-page__title {
  margin: 0 0 $spacing-1;
  font-family: $font-family-display;
  font-size: $font-size-h3;
  font-weight: $font-weight-regular;
  color: $text-primary;
}

.photo-frames-page__subtitle {
  margin: 0;
  color: $text-secondary;
  font-size: $font-size-body-sm;
  max-width: 520px;
}

.photo-frames-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-12;
  border: 1px dashed $border-light;
  border-radius: $radius-md;
  color: $text-muted;
  text-align: center;
}

.photo-frames-page__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.photo-frames-page__item {
  display: grid;
  grid-template-columns: auto 56px 1fr auto auto;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-3 $spacing-4;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  cursor: grab;

  &--dragging {
    opacity: 0.55;
  }
}

.photo-frames-page__drag {
  color: $text-muted;
}

.photo-frames-page__preview {
  width: 48px;
  height: 48px;
  border-radius: $radius-sm;
  overflow: hidden;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 12px 12px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 6px 6px / 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.photo-frames-page__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.photo-frames-page__name {
  font-weight: $font-weight-medium;
}

.photo-frames-page__dims {
  font-size: $font-size-caption;
  color: $text-muted;
}

.photo-frames-page__actions {
  display: flex;
  gap: $spacing-1;
}

// ── Form ──────────────────────────────────────────────────────────────────────
.photo-frames-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding-top: $spacing-2;
}

// Wrapper centers the preview and provides the checker backdrop; it can be
// wider than the actual image (letterboxing), so percentage-based guides
// must NOT live here — they're on `.photo-frames-form__preview`, which
// shrink-wraps to the image's real rendered bounds (see below), keeping
// guide percentages aligned with what the admin actually sees.
.photo-frames-form__preview-wrap {
  display: flex;
  justify-content: center;
  width: 100%;
  max-height: 240px;
  overflow: hidden;
  border-radius: $radius-sm;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 16px 16px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 8px 8px / 16px 16px;
}

.photo-frames-form__preview {
  position: relative;
  max-width: 100%;
  max-height: 240px;
  // No explicit width — as a flex item this shrink-wraps to the img's own
  // rendered size, so absolutely-positioned guide overlays land exactly on
  // the visible image edges instead of a wider letterboxed container.

  img {
    display: block;
    max-width: 100%;
    max-height: 240px;
    width: auto;
    height: auto;
  }
}

.photo-frames-form__guide {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgb(var(--v-theme-primary));
  pointer-events: none;

  &--vertical {
    left: auto;
    right: auto;
    top: 0;
    bottom: 0;
    width: 0;
    height: auto;
    border-top: none;
    border-left: 1px dashed rgb(var(--v-theme-primary));
  }
}

.photo-frames-form__area {
  position: absolute;
  border: 2px solid #16a34a;
  background: rgba(22, 163, 74, 0.14);
  pointer-events: none;
}

.photo-frames-form__dims {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.photo-frames-form__section-label {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.photo-frames-form__slices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-3;
}
</style>
