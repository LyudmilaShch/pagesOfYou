<template>
  <div class="editor-photo-frame-field">
    <p class="editor-photo-frame-field__label">Рамка</p>

    <div v-if="props.frame" class="editor-photo-frame-field__current">
      <div class="editor-photo-frame-field__preview">
        <img :src="props.frame.imageUrl" alt="Рамка" />
      </div>
      <div class="editor-photo-frame-field__actions">
        <v-btn size="small" variant="outlined" @click="pickerOpen = true">Изменить</v-btn>
        <v-btn size="small" variant="text" color="error" @click="emit('patch', { frame: null })">
          Убрать рамку
        </v-btn>
      </div>
    </div>

    <v-btn v-else size="small" variant="outlined" prepend-icon="mdi-image-frame" @click="pickerOpen = true">
      Выбрать рамку
    </v-btn>

    <v-dialog v-model="pickerOpen" max-width="420">
      <v-card>
        <v-card-title>Выберите рамку</v-card-title>
        <v-divider />
        <v-card-text>
          <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

          <p v-else-if="activeFrames.length === 0" class="editor-photo-frame-field__empty">
            Рамки ещё не добавлены в админке
          </p>

          <div v-else class="editor-photo-frame-field__grid">
            <button
              v-for="item in activeFrames"
              :key="item.id"
              type="button"
              class="editor-photo-frame-field__grid-item"
              :title="item.name"
              @click="selectFrame(item)"
            >
              <img :src="item.imageUrl" :alt="item.name" />
            </button>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="pickerOpen = false">Закрыть</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PhotoFrameRef } from '../models/photo-placeholder.model'
import { adminPhotoFramesApi, type AdminPhotoFrame } from '@/shared/api/admin/photo-frames.api'

const props = defineProps<{
  frame: PhotoFrameRef | null | undefined
}>()

const emit = defineEmits<{
  patch: [patch: { frame: PhotoFrameRef | null }]
}>()

const pickerOpen = ref(false)
const loading = ref(false)
const frames = ref<AdminPhotoFrame[]>([])
const activeFrames = computed(() => frames.value.filter((item) => item.isActive))

async function loadFrames(): Promise<void> {
  loading.value = true
  try {
    frames.value = await adminPhotoFramesApi.list()
  } catch {
    frames.value = []
  } finally {
    loading.value = false
  }
}

watch(pickerOpen, (open) => {
  if (open && frames.value.length === 0) {
    void loadFrames()
  }
})

function selectFrame(item: AdminPhotoFrame): void {
  emit('patch', {
    frame: {
      imageUrl: item.imageUrl,
      naturalWidth: item.naturalWidth,
      naturalHeight: item.naturalHeight,
      sliceTop: item.sliceTop,
      sliceRight: item.sliceRight,
      sliceBottom: item.sliceBottom,
      sliceLeft: item.sliceLeft,
      photoAreaTop: item.photoAreaTop,
      photoAreaRight: item.photoAreaRight,
      photoAreaBottom: item.photoAreaBottom,
      photoAreaLeft: item.photoAreaLeft,
    },
  })
  pickerOpen.value = false
}
</script>

<style scoped lang="scss">
.editor-photo-frame-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-photo-frame-field__label {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-photo-frame-field__current {
  display: flex;
  align-items: center;
  gap: $spacing-3;
}

.editor-photo-frame-field__preview {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 10px 10px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 5px 5px / 10px 10px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.editor-photo-frame-field__actions {
  display: flex;
  gap: $spacing-2;
  flex-wrap: wrap;
}

.editor-photo-frame-field__empty {
  margin: 0;
  font-size: $font-size-body-sm;
  color: $text-muted;
}

.editor-photo-frame-field__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-2;
}

.editor-photo-frame-field__grid-item {
  aspect-ratio: 1;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 10px 10px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 5px 5px / 10px 10px;
  cursor: pointer;
  padding: $spacing-1;

  &:hover {
    border-color: $border-default;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}
</style>
