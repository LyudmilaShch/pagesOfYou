<template>
  <div class="question-image-field">
    <div class="question-image-field__preview">
      <img v-if="modelValue" :src="modelValue" alt="" />
      <v-icon v-else size="28" color="grey">mdi-image-outline</v-icon>
    </div>

    <div class="question-image-field__actions">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="question-image-field__file-input"
        @change="handleFileSelected"
      />
      <v-btn
        variant="outlined"
        size="small"
        prepend-icon="mdi-tray-arrow-up"
        :loading="uploading"
        @click="fileInputRef?.click()"
      >
        {{ modelValue ? 'Заменить' : 'Загрузить' }}
      </v-btn>
      <v-btn variant="outlined" size="small" prepend-icon="mdi-image-multiple-outline" @click="pickerOpen = true">
        Из галереи
      </v-btn>
      <v-btn v-if="modelValue" variant="text" size="small" color="error" @click="emit('update:modelValue', null)">
        Удалить
      </v-btn>
    </div>

    <PhotoGalleryPickerDialog
      :open="pickerOpen"
      :scope="scope"
      @select="handlePickerSelect"
      @close="pickerOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { photoGalleryApi, type PhotoGalleryScope } from '../../api/photo-gallery.api'
import PhotoGalleryPickerDialog from '../PhotoGalleryPickerDialog.vue'

const props = defineProps<{
  modelValue: string | null
  scope: PhotoGalleryScope
}>()

const emit = defineEmits<{
  'update:modelValue': [url: string | null]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const pickerOpen = ref(false)

async function handleFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''

  if (!file) {
    return
  }

  uploading.value = true
  try {
    const dimensions = await getImageDimensions(file).catch(() => undefined)
    const uploaded = await photoGalleryApi.upload(props.scope, file, dimensions)
    emit('update:modelValue', uploaded.url)
  } finally {
    uploading.value = false
  }
}

function handlePickerSelect(url: string): void {
  pickerOpen.value = false
  emit('update:modelValue', url)
}
</script>

<style scoped lang="scss">
.question-image-field {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  flex-wrap: wrap;
}

.question-image-field__preview {
  width: 72px;
  height: 72px;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.question-image-field__actions {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.question-image-field__file-input {
  display: none;
}
</style>
