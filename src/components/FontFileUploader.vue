<template>
  <div class="font-uploader">
    <!-- ── Preview state ──────────────────────────────────────────────────── -->
    <div v-if="displayUrl" class="font-uploader__preview">
      <div class="font-uploader__preview-icon-wrap">
        <v-icon size="28" class="font-uploader__preview-icon">mdi-file-font-outline</v-icon>
      </div>

      <div class="font-uploader__preview-meta">
        <p class="font-uploader__preview-name">{{ pendingFile?.name ?? 'Файл загружен' }}</p>
        <p v-if="pendingFile" class="font-uploader__preview-size">
          {{ formatBytes(pendingFile.size) }}
        </p>

        <!-- Upload progress / status -->
        <div v-if="uploading" class="font-uploader__status font-uploader__status--loading">
          <v-progress-circular size="14" width="2" indeterminate color="primary" />
          <span>Загрузка…</span>
        </div>
        <div v-else-if="uploadError" class="font-uploader__status font-uploader__status--error">
          <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
          <span>{{ uploadError }}</span>
        </div>
        <div v-else-if="modelValue" class="font-uploader__status font-uploader__status--ok">
          <v-icon size="14" color="success">mdi-check-circle-outline</v-icon>
          <span>Загружено</span>
        </div>

        <div class="font-uploader__preview-actions">
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

          <!-- Change file -->
          <v-btn
            size="small"
            variant="text"
            prepend-icon="mdi-file-replace-outline"
            :disabled="uploading"
            @click="triggerInput"
          >
            Заменить
          </v-btn>

          <!-- Remove -->
          <v-btn
            v-if="removable"
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-outline"
            :disabled="uploading"
            @click="removeFile"
          >
            Удалить
          </v-btn>
        </div>
      </div>
    </div>

    <!-- ── Drop zone ──────────────────────────────────────────────────────── -->
    <div
      v-else
      class="font-uploader__zone"
      :class="{ 'font-uploader__zone--drag': isDragging, 'font-uploader__zone--error': !!validationError }"
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @dragover.prevent
      @drop.prevent="onDrop"
      @click="triggerInput"
    >
      <v-icon size="28" class="font-uploader__zone-icon">mdi-tray-arrow-up</v-icon>
      <p class="font-uploader__zone-text">{{ label }}</p>
      <p class="font-uploader__zone-or">или</p>
      <v-btn
        variant="tonal"
        size="small"
        color="primary"
        prepend-icon="mdi-folder-open-outline"
        @click.stop="triggerInput"
      >
        Выберите файл
      </v-btn>
      <p class="font-uploader__zone-hint">TTF, OTF, WOFF, WOFF2 · до {{ maxUploadSizeLabel }}</p>
    </div>

    <!-- Validation error shown below the zone -->
    <p v-if="validationError" class="font-uploader__validation-error">
      <v-icon size="14" color="error">mdi-alert-circle-outline</v-icon>
      {{ validationError }}
    </p>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".ttf,.otf,.woff,.woff2"
      class="font-uploader__input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uploadAdminFont } from '@/shared/api/admin/uploads.api'
import { useErrorMessageModal } from '@/shared/composables/useErrorMessageModal'
import {
  formatMaxFontUploadSizeLabel,
  getMaxFontUploadSizeErrorMessage,
  MAX_FONT_UPLOAD_SIZE_BYTES,
} from '@/shared/constants/upload.constants'
import { resolveAssetUrl } from '@/shared/config/assets'
import { getUploadErrorMessage } from '@/shared/utils/api-error.util'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    /** Drop-zone label, e.g. "Regular (обязательно)" / "Bold" */
    label?: string
    /** Regular is required — its slot shouldn't offer a "Удалить" action once uploaded. */
    removable?: boolean
  }>(),
  { modelValue: null, label: 'Перетащите файл шрифта сюда', removable: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', url: string | null): void
}>()

const { showErrorMessageModal } = useErrorMessageModal()

// ── State ─────────────────────────────────────────────────────────────────────

const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingFile = ref<File | null>(null)
const localFileUrl = ref<string | null>(null)
const uploading = ref(false)
const uploadError = ref<string | null>(null)
const validationError = ref<string | null>(null)
const isDragging = ref(false)

const ALLOWED_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2']
const maxUploadSizeLabel = formatMaxFontUploadSizeLabel()

// ── Computed ──────────────────────────────────────────────────────────────────

const displayUrl = computed<string | null>(() => {
  if (localFileUrl.value) {
    return localFileUrl.value
  }

  return resolveAssetUrl(props.modelValue)
})

// When parent resets modelValue to null (new form opened), clear local state
watch(
  () => props.modelValue,
  (val) => {
    if (!val) {
      localFileUrl.value = null
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

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase()
}

function processFile(file: File) {
  validationError.value = null
  uploadError.value = null

  // Browsers/OSes report inconsistent MIME types for font files — validate by extension.
  if (!ALLOWED_EXTENSIONS.includes(getExtension(file.name))) {
    validationError.value = 'Неподдерживаемый формат. Используйте TTF, OTF, WOFF или WOFF2.'
    return
  }
  if (file.size > MAX_FONT_UPLOAD_SIZE_BYTES) {
    validationError.value = getMaxFontUploadSizeErrorMessage()
    return
  }

  pendingFile.value = file
  startUpload(file)
}

async function startUpload(file: File) {
  uploading.value = true
  uploadError.value = null
  try {
    const { url } = await uploadAdminFont(file)
    localFileUrl.value = url
    emit('update:modelValue', url)
  } catch (err: unknown) {
    const msg = getUploadErrorMessage(err)
    uploadError.value = msg
    showErrorMessageModal(msg, 'Не удалось загрузить шрифт')
  } finally {
    uploading.value = false
  }
}

function retryUpload() {
  if (!pendingFile.value) return
  startUpload(pendingFile.value)
}

function removeFile() {
  localFileUrl.value = null
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
.font-uploader {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
.font-uploader__zone {
  border: 2px dashed $border-light;
  border-radius: $radius-md;
  padding: $spacing-4 $spacing-4;
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

.font-uploader__zone-icon {
  color: $text-muted;
}

.font-uploader__zone-text {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-secondary;
  margin: 0;
}

.font-uploader__zone-or {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.font-uploader__zone-hint {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: $spacing-1 0 0;
}

// ── Preview state ─────────────────────────────────────────────────────────────
.font-uploader__preview {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-secondary;
}

.font-uploader__preview-icon-wrap {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-tertiary;
}

.font-uploader__preview-icon {
  color: $text-muted;
}

.font-uploader__preview-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.font-uploader__preview-name {
  font-family: $font-family-body;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-uploader__preview-size {
  font-size: $font-size-caption;
  color: $text-muted;
  margin: 0;
}

.font-uploader__status {
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

.font-uploader__preview-actions {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  flex-wrap: wrap;
  margin-top: $spacing-2;
}

// ── Validation error ──────────────────────────────────────────────────────────
.font-uploader__validation-error {
  display: flex;
  align-items: center;
  gap: $spacing-1;
  font-size: $font-size-caption;
  color: rgb(var(--v-theme-error));
  margin: 0;
  padding: 0 $spacing-1;
}

// ── Hidden native input ───────────────────────────────────────────────────────
.font-uploader__input {
  display: none;
}
</style>
