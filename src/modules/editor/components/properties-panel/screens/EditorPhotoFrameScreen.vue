<template>
  <div class="editor-photo-frame-screen">
    <div v-if="loading" class="editor-photo-frame-screen__loading">
      <v-progress-circular indeterminate size="24" />
    </div>

    <div v-else class="editor-photo-frame-screen__grid">
      <button
        type="button"
        class="editor-photo-frame-screen__card"
        :class="{ 'editor-photo-frame-screen__card--active': !activeFrame }"
        @click="removeFrame"
      >
        <span class="editor-photo-frame-screen__thumb">
          <v-icon size="24" color="textMuted">mdi-image-frame</v-icon>
        </span>
        <span class="editor-photo-frame-screen__label">Без рамки</span>
      </button>

      <button
        v-for="item in activeFrames"
        :key="item.id"
        type="button"
        class="editor-photo-frame-screen__card"
        :class="{ 'editor-photo-frame-screen__card--active': activeFrame?.imageUrl === item.imageUrl }"
        @click="selectFrame(item)"
      >
        <span class="editor-photo-frame-screen__thumb">
          <img :src="item.imageUrl" :alt="item.name" />
        </span>
        <span class="editor-photo-frame-screen__label">{{ item.name }}</span>
      </button>
    </div>

    <p v-if="!loading && activeFrames.length === 0" class="editor-photo-frame-screen__empty">
      Рамки ещё не добавлены в админке
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import type { PhotoFrameRef } from '../../../models/photo-placeholder.model'
import type { PhotoPlaceholder } from '../../../models/photo-placeholder.model'
import { adminPhotoFramesApi, type AdminPhotoFrame } from '@/shared/api/admin/photo-frames.api'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const photoElement = computed(() => selected.value as PhotoPlaceholder | null)
const activeFrame = computed<PhotoFrameRef | null>(() => photoElement.value?.frame ?? null)

const loading = ref(false)
const frames = ref<AdminPhotoFrame[]>([])
const activeFrames = computed(() => frames.value.filter((item) => item.isActive))

onMounted(async () => {
  loading.value = true
  try {
    frames.value = await adminPhotoFramesApi.list()
  } catch {
    frames.value = []
  } finally {
    loading.value = false
  }
})

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function removeFrame(): void {
  patchElement({ frame: null })
}

function selectFrame(item: AdminPhotoFrame): void {
  patchElement({
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
}
</script>

<style scoped lang="scss">
@use '@/modules/editor/styles/properties-panel-theme' as pp;

.editor-photo-frame-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-photo-frame-screen__loading {
  display: flex;
  justify-content: center;
  padding: $spacing-6 0;
}

.editor-photo-frame-screen__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $spacing-3;
}

.editor-photo-frame-screen__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  gap: $spacing-2;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.editor-photo-frame-screen__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1.5px solid pp.$border;
  border-radius: $radius-md;
  background: $white;
  overflow: hidden;
  transition: border-color 0.12s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .editor-photo-frame-screen__card:hover & {
    border-color: pp.$border-strong;
  }
}

.editor-photo-frame-screen__card--active .editor-photo-frame-screen__thumb {
  border-color: pp.$accent;
  border-width: 2px;
}

.editor-photo-frame-screen__label {
  font-size: $font-size-caption;
  color: pp.$ink-soft;
}

.editor-photo-frame-screen__card--active .editor-photo-frame-screen__label {
  color: pp.$accent-deep;
  font-weight: $font-weight-semibold;
}

.editor-photo-frame-screen__empty {
  margin: 0;
  font-size: $font-size-body-sm;
  color: pp.$ink-soft;
}
</style>
