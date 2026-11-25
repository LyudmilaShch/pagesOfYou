<template>
  <div class="phone-upload">
    <header class="phone-upload__bar">
      <p class="phone-upload__brand">Вау, ми!</p>
    </header>

    <main class="phone-upload__main">
      <div v-if="state === 'checking'" class="phone-upload__state">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else-if="state === 'closed'" class="phone-upload__state">
        <v-icon size="40" color="primary">mdi-qrcode-remove</v-icon>
        <h1 class="text-h4">Ссылка недействительна</h1>
        <p>Откройте новый код на компьютере, на шаге с фотографиями.</p>
      </div>

      <div v-else class="phone-upload__panel">
        <h1 class="text-h4">Добавьте фото</h1>
        <p class="phone-upload__lead">Они сразу появятся в журнале на компьютере.</p>

        <input
          ref="libraryInput"
          class="phone-upload__file"
          type="file"
          :accept="PHOTO_FILE_ACCEPT"
          multiple
          @change="onLibrarySelected"
        />
        <input
          ref="cameraInput"
          class="phone-upload__file"
          type="file"
          :accept="PHOTO_FILE_ACCEPT"
          capture="environment"
          @change="onCameraSelected"
        />

        <v-btn color="primary" size="large" block :loading="uploading" @click="libraryInput?.click()">
          Выбрать из галереи
        </v-btn>
        <v-btn variant="outlined" color="primary" size="large" block :disabled="uploading" @click="cameraInput?.click()">
          Сделать фото
        </v-btn>

        <PhotoUploadFormatsHint />
        <PhotoUploadErrorList :messages="uploadErrors" />

        <p v-if="sentPhotos.length > 0" class="phone-upload__sent">Отправлено: {{ sentPhotos.length }}</p>
        <ul v-if="sentPhotos.length > 0" class="phone-upload__thumbs">
          <li v-for="photo in sentPhotos" :key="photo.id">
            <img :src="photo.url" :alt="photo.name" />
          </li>
        </ul>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'

import { PHOTO_FILE_ACCEPT } from '@/shared/constants/photo-upload.constants'
import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { runPhotoUploads } from '@/shared/utils/photo-upload-error.util'
import { phoneUploadApi } from '../api/phone-upload.api'
import PhotoUploadErrorList from '../components/PhotoUploadErrorList.vue'
import PhotoUploadFormatsHint from '../components/PhotoUploadFormatsHint.vue'

interface SentPhoto {
  id: string
  name: string
  url: string
}

const route = useRoute()
const libraryInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)
const state = ref<'checking' | 'open' | 'closed'>('checking')
const uploading = ref(false)
const uploadErrors = ref<string[]>([])
const sentPhotos = ref<SentPhoto[]>([])

function uploadToken(): string {
  const value = route.params.token
  return typeof value === 'string' ? value : ''
}

function isLinkClosed(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 410
}

function rememberSent(file: File): void {
  sentPhotos.value = [
    { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) },
    ...sentPhotos.value,
  ]
}

async function uploadFiles(files: File[]): Promise<void> {
  if (files.length === 0 || state.value !== 'open') {
    return
  }

  const token = uploadToken()
  uploading.value = true
  uploadErrors.value = []
  try {
    const problems = await runPhotoUploads(files, async (file) => {
      if (state.value !== 'open') {
        throw new Error('Ссылка больше не действует.')
      }
      const dimensions = await getImageDimensions(file).catch(() => undefined)
      try {
        await phoneUploadApi.upload(token, file, dimensions)
      } catch (err: unknown) {
        if (isLinkClosed(err)) {
          state.value = 'closed'
        }
        throw err
      }
      rememberSent(file)
    })
    uploadErrors.value = [...new Set(problems)]
  } finally {
    uploading.value = false
  }
}

function onLibrarySelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  void uploadFiles(files)
}

function onCameraSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  void uploadFiles(files)
}

onBeforeUnmount(() => {
  for (const photo of sentPhotos.value) {
    URL.revokeObjectURL(photo.url)
  }
})

const token = uploadToken()
if (!token) {
  state.value = 'closed'
} else {
  void phoneUploadApi.status(token).then(
    (status) => {
      state.value = status.valid ? 'open' : 'closed'
    },
    () => {
      state.value = 'closed'
    },
  )
}
</script>

<style scoped lang="scss">
.phone-upload {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: $bg-primary;
}

.phone-upload__bar {
  padding: $spacing-4 $spacing-6;
  border-bottom: 1px solid $border-light;
  background: $bg-elevated;
}

.phone-upload__brand {
  margin: 0;
  font-weight: $font-weight-semibold;
}

.phone-upload__main {
  flex: 1;
  padding: $spacing-6 $spacing-6 $spacing-12;
}

.phone-upload__state,
.phone-upload__panel {
  max-width: 420px;
  margin-inline: auto;
}

.phone-upload__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  padding-top: $spacing-12;
  text-align: center;
  color: $text-secondary;

  h1 {
    margin: 0;
    color: $text-primary;
  }

  p {
    margin: 0;
  }
}

.phone-upload__panel {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  h1 {
    margin: 0;
  }
}

.phone-upload__lead,
.phone-upload__sent {
  margin: 0;
  color: $text-secondary;
}

.phone-upload__file {
  display: none;
}

.phone-upload__thumbs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-2;
  margin: $spacing-2 0 0;
  padding: 0;
  list-style: none;

  img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: $radius-md;
    display: block;
    background: $bg-muted;
  }
}
</style>
