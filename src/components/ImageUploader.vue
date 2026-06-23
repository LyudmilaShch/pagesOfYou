<template>
  <div class="img-uploader">
    <!-- ── Preview state ──────────────────────────────────────────────────── -->
    <div v-if="displayUrl" class="img-uploader__preview">
      <div class="img-uploader__preview-img-wrap">
        <img :src="displayUrl" alt="Обложка" class="img-uploader__preview-img" />
      </div>

      <div class="img-uploader__preview-meta">
        <p class="img-uploader__preview-name">{{ pendingFile?.name ?? 'Текущее изображение' }}</p>
        <p v-if="pendingFile" class="img-uploader__preview-size">
          {{ formatBytes(pendingFile.size) }}
        </p>

        <!-- Upload progress / status -->
        <div v-if="uploading" class="img-uploader__status img-uploader__status--loading">
          <v-progress-circular size="14" width="2" indeterminate color="primary" />
          <span>Загрузка…</span>
        </div>
        <div v-else-if="uploadError" class="img-uploader__status img-uploader__status--error">
          <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
          <span>{{ uploadError }}</span>
        </div>
        <div v-else-if="modelValue" class="img-uploader__status img-uploader__status--ok">
          <v-icon size="14" color="success">mdi-check-circle-outline</v-icon>
          <span>Загружено</span>
        </div>

        <div class="img-uploader__preview-actions">
          <!-- Re-upload button (visible only on error) -->
          <v-btn
            v-if="uploadError"
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-refresh"
            :disabled="uploading"
            @click="retryUpload"
          >
            Повторить
          </v-btn>

          <!-- Change image -->
          <v-btn
            size="small"
            variant="text"
            prepend-icon="mdi-image-edit-outline"
            :disabled="uploading"
            @click="triggerInput"
          >
            Заменить
          </v-btn>

          <!-- Remove -->
          <v-btn
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-outline"
            :disabled="uploading"
            @click="removeImage"
          >
            Удалить
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ── Drop zone ──────────────────────────────────────────────────────── -->
    <div
      v-else
      class="img-uploader__zone"
      :class="{ 'img-uploader__zone--drag': isDragging, 'img-uploader__zone--error': !!validationError }"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @dragover.prevent
      @drop.prevent="onDrop"
      @click="triggerInput"
    >
      <v-icon size="32" class="img-uploader__zone-icon">mdi-image-plus-outline</v-icon>
      <p class="img-uploader__zone-text">Перетащите изображение сюда</p>
      <p class="img-uploader__zone-or">или</p>
      <v-btn
        variant="tonal"
        size="small"
        color="primary"
        prepend-icon="mdi-folder-open-outline"
        @click.stop="triggerInput"
      >
        Выберите файл
      </v-btn>
      <p class="img-uploader__zone-hint">JPG, PNG, WebP · до 5 МБ</p>
    </div>

    <!-- Validation error shown below the zone -->
    <p v-if="validationError" class="img-uploader__validation-error">
      <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
      {{ validationError }}
    </p>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/jpg,image/png,image/webp"
      class="img-uploader__input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uploadAdminImage } from '@/shared/api/admin/uploads.api'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
  }>(),
  { modelValue: null },
)

const emit = defineEmits<{
  (e: 'update:modelValue', url: string | null): void
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)
const localPreviewUrl = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)
const validationError = ref<string | null>(null)
const isDragging = ref(false)

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// ── Computed ──────────────────────────────────────────────────────────────────

/** Priority: local blob preview → server URL from modelValue */
const displayUrl = computed<string | null>(
  () => localPreviewUrl.value ?? (props.modelValue || null),
)

// When parent resets modelValue to null (new form opened), clear local state
watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      localPreviewUrl.value = null
      pendingFile.value = null
      uploadError.value = null
    }
  },
)

// ── Methods ───────────────────────────────────────────────────────────────────

function triggerInput() {
  fileInputRef.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // reset so same file can be re-selected
  processFile(file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  processFile(file)
}

function processFile(file: File) {
  validationError.value = null
  uploadError.value = null

  if (!ALLOWED_TYPES.includes(file.type)) {
    validationError.value = 'Неподдерживаемый формат. Используйте JPG, PNG или WebP.'
    return
  }
  if (file.size > MAX_SIZE) {
    validationError.value = 'Файл слишком большой. Максимум 5 МБ.'
    return
  }

  pendingFile.value = file
  // Create a local preview immediately for instant feedback
  localPreviewUrl.value = URL.createObjectURL(file)

  startUpload(file)
}

async function startUpload(file: File) {
  uploading.value = true
  uploadError.value = null
  try {
    const { url } = await uploadAdminImage(file)
    // Replace blob URL with real server URL
    URL.revokeObjectURL(localPreviewUrl.value ?? '')
    localPreviewUrl.value = url
    emit('update:modelValue', url)
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Ошибка загрузки. Попробуйте ещё раз.'
    uploadError.value = msg
    // Keep the local blob preview so user sees what they tried to upload
  } finally {
    uploading.value = false
  }
}

function retryUpload() {
  if (!pendingFile.value) return
  startUpload(pendingFile.value)
}

function removeImage() {
  if (localPreviewUrl.value?.startsWith('blob:')) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
  localPreviewUrl.value = null
  pendingFile.value = null
  uploadError.value = null
  validationError.value = null
  emit('update:modelValue', null)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
</script>

<style scoped lang="scss">
.img-uploader {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
.img-uploader__zone {
  border: 2px dashed $border-light;
  border-radius: $radius-md;
  padding: $spacing-8 $spacing-6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-2;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
  background: $bg-secondary;
  text-align: center;

  &:hover,
  &--drag {
    border-color: rgb(var(--v-theme-primary));
    background: rgba(var(--v-theme-primary), 0.04);
  }

  &--error {
    border-color: rgb(var(--v-theme-error));
  }
}

.img-uploader__zone-icon {
  color: $text-muted;
  margin-bottom: $spacing-1;
}

.img-uploader__zone-text {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-secondary;
  margin: 0;
}

.img-uploader__zone-or {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.img-uploader__zone-hint {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: $spacing-1 0 0;
}

// ── Preview state ─────────────────────────────────────────────────────────────
.img-uploader__preview {
  display: flex;
  align-items: flex-start;
  gap: $spacing-4;
  padding: $spacing-4;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-secondary;
}

.img-uploader__preview-img-wrap {
  flex-shrink: 0;
  width: 80px;
  height: 107px; // 3:4 ratio
  border-radius: $radius-sm;
  overflow: hidden;
  background: $bg-tertiary;
}

.img-uploader__preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.img-uploader__preview-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.img-uploader__preview-name {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.img-uploader__preview-size {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.img-uploader__status {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  font-size: $font-size-caption;
  margin-top: $spacing-1;

  &--loading {
    color: rgb(var(--v-theme-primary));
  }

  &--error {
    color: rgb(var(--v-theme-error));
  }

  &--ok {
    color: rgb(var(--v-theme-success));
  }
}

.img-uploader__preview-actions {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  flex-wrap: wrap;
  margin-top: $spacing-2;
}

// ── Validation error ──────────────────────────────────────────────────────────
.img-uploader__validation-error {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  font-size: $font-size-caption;
  color: rgb(var(--v-theme-error));
  margin: 0;
  padding: 0 $spacing-1;
}

// ── Hidden native input ───────────────────────────────────────────────────────
.img-uploader__input {
  display: none;
}
</style>
