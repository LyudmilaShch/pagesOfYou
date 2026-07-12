<template>
  <div class="editor-library">
    <div class="editor-library__list">
      <button
        v-for="item in items"
        :key="item.type"
        type="button"
        class="editor-library__item"
        :disabled="store.previewMode"
        @click="handleAdd(item.type)"
      >
        <span class="editor-library__item-icon">
          <v-icon size="18">{{ item.icon }}</v-icon>
        </span>
        <span class="editor-library__item-content">
          <span class="editor-library__item-label">{{ item.label }}</span>
          <span class="editor-library__item-description">{{ item.description }}</span>
        </span>
      </button>
    </div>

    <div v-if="category === 'photo'" class="editor-library__frames">
      <p class="editor-library__frames-title">Фоторамки</p>

      <v-progress-linear v-if="loadingFrames" indeterminate color="primary" />

      <p v-else-if="activeFrames.length === 0" class="editor-library__frames-empty">
        Рамки ещё не добавлены в админке
      </p>

      <div v-else class="editor-library__frames-grid">
        <button
          v-for="frame in activeFrames"
          :key="frame.id"
          type="button"
          class="editor-library__frame"
          :disabled="store.previewMode"
          :title="frame.name"
          @click="handleAddFramedPhoto(frame)"
        >
          <img :src="frame.imageUrl" :alt="frame.name" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { LIBRARY_ELEMENTS } from '../factories/create-element.factory'
import type { LibraryElementCategory, LibraryElementType } from '../factories/create-element.factory'
import { useEditorStore } from '../store/editor.store'
import { adminPhotoFramesApi, type AdminPhotoFrame } from '@/shared/api/admin/photo-frames.api'

const props = defineProps<{
  category: LibraryElementCategory
}>()

const store = useEditorStore()

const items = computed(() => LIBRARY_ELEMENTS.filter((item) => item.category === props.category))

const frames = ref<AdminPhotoFrame[]>([])
const loadingFrames = ref(false)
const activeFrames = computed(() => frames.value.filter((frame) => frame.isActive))

async function loadFrames(): Promise<void> {
  loadingFrames.value = true
  try {
    frames.value = await adminPhotoFramesApi.list()
  } catch {
    frames.value = []
  } finally {
    loadingFrames.value = false
  }
}

function handleAdd(type: LibraryElementType): void {
  if (store.previewMode) {
    return
  }
  store.addElement(type)
}

function handleAddFramedPhoto(frame: AdminPhotoFrame): void {
  if (store.previewMode) {
    return
  }
  store.addFramedPhoto(frame)
}

onMounted(() => {
  void loadFrames()
})
</script>

<style scoped lang="scss">
.editor-library {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-library__list {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-4;
  overflow-y: auto;
}

.editor-library__item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  width: 100%;
  padding: $spacing-3;
  border: 1px solid $border-light;
  border-radius: $radius-md;
  background: $bg-elevated;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;

  &:hover:not(:disabled) {
    background: $state-hover-bg;
    border-color: $border-default;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.editor-library__item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  background: $bg-muted;
  color: $text-primary;
  flex-shrink: 0;
}

.editor-library__item-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.editor-library__item-label {
  font-size: $font-size-body-sm;
  font-weight: $font-weight-medium;
  color: $text-primary;
}

.editor-library__item-description {
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-library__frames {
  padding: 0 $spacing-4 $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.editor-library__frames-title {
  margin: 0;
  font-size: $font-size-caption;
  font-weight: $font-weight-medium;
  letter-spacing: $letter-spacing-caption;
  text-transform: uppercase;
  color: $text-muted;
}

.editor-library__frames-empty {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-muted;
}

.editor-library__frames-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-2;
}

.editor-library__frame {
  aspect-ratio: 1;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background:
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 0 0 / 10px 10px,
    linear-gradient(45deg, $bg-muted 25%, transparent 25%, transparent 75%, $bg-muted 75%) 5px 5px / 10px 10px;
  cursor: pointer;
  padding: $spacing-1;
  transition: border-color 0.18s ease;

  &:hover:not(:disabled) {
    border-color: $border-default;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}
</style>
