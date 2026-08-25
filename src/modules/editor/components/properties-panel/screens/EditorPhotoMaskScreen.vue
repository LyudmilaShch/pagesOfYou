<template>
  <div class="editor-photo-mask-screen">
    <!-- objectBoundingBox clip works at any thumbnail pixel size — needed for the heart shape,
         which can't be expressed as a native CSS basic-shape function. -->
    <svg width="0" height="0" style="position: absolute">
      <defs>
        <clipPath id="photo-mask-heart-clip" clipPathUnits="objectBoundingBox">
          <path
            d="M 0.5 0.85 C 0.2 0.65, 0 0.45, 0 0.25 C 0 0.05, 0.25 -0.05, 0.5 0.15 C 0.75 -0.05, 1 0.05, 1 0.25 C 1 0.45, 0.8 0.65, 0.5 0.85 Z"
          />
        </clipPath>
      </defs>
    </svg>

    <div class="editor-photo-mask-screen__grid">
      <button
        type="button"
        class="editor-photo-mask-screen__card"
        :class="{ 'editor-photo-mask-screen__card--active': !activeMask }"
        @click="selectNone"
      >
        <span class="editor-photo-mask-screen__thumb">
          <img v-if="photoUrl" :src="photoUrl" alt="" />
          <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
          <v-icon v-if="!activeMask" size="14" class="editor-photo-mask-screen__check">mdi-check</v-icon>
        </span>
        <span class="editor-photo-mask-screen__label">Без маски</span>
      </button>

      <button
        v-for="def in PHOTO_MASK_DESCRIPTORS"
        :key="def.type"
        type="button"
        class="editor-photo-mask-screen__card"
        :class="{ 'editor-photo-mask-screen__card--active': activeMask?.type === def.type }"
        @click="selectMask(def.type)"
      >
        <span class="editor-photo-mask-screen__thumb">
          <img v-if="photoUrl" :src="photoUrl" alt="" :style="{ clipPath: def.cssClipPath }" />
          <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
          <v-icon
            v-if="activeMask?.type === def.type"
            size="14"
            class="editor-photo-mask-screen__check"
          >
            mdi-check
          </v-icon>
        </span>
        <span class="editor-photo-mask-screen__label">{{ def.label }}</span>
      </button>

      <button
        v-for="custom in customMasks"
        :key="custom.id"
        type="button"
        class="editor-photo-mask-screen__card"
        :class="{ 'editor-photo-mask-screen__card--active': isActiveCustomMask(custom) }"
        @click="selectCustomMask(custom)"
      >
        <span class="editor-photo-mask-screen__thumb">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            alt=""
            :style="{ clipPath: getCustomPhotoMaskCssClipPath(custom.points) }"
          />
          <v-icon v-else size="20" color="textMuted">mdi-image-outline</v-icon>
          <v-icon v-if="isActiveCustomMask(custom)" size="14" class="editor-photo-mask-screen__check">
            mdi-check
          </v-icon>
        </span>
        <span class="editor-photo-mask-screen__label">{{ custom.name }}</span>
      </button>
    </div>

    <p v-if="activeMask" class="editor-photo-mask-screen__hint">
      Дважды нажмите на фото (или кнопку «Редактировать» в свойствах) — можно перемещать,
      масштабировать и вращать изображение внутри маски.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorStore } from '../../../store/editor.store'
import type { ElementPatch } from '../../../store/editor.store'
import { PHOTO_MASK_DESCRIPTORS, getCustomPhotoMaskCssClipPath } from '../../../models/photo-mask.model'
import type { PhotoMask, PhotoMaskType } from '../../../models/photo-mask.model'
import type { PhotoPlaceholder } from '../../../models/photo-placeholder.model'
import { resolveAssetUrl } from '@/shared/config/assets'
import { adminCustomPhotoMasksApi } from '@/shared/api/admin/custom-photo-masks.api'
import type { AdminCustomPhotoMask } from '@/shared/api/admin/custom-photo-masks.api'

const store = useEditorStore()
const { selectedElement: selected } = storeToRefs(store)

const photoElement = computed(() => selected.value as PhotoPlaceholder | null)
const activeMask = computed<PhotoMask | null>(() => photoElement.value?.mask ?? null)
const photoUrl = computed(() => resolveAssetUrl(photoElement.value?.defaultImageUrl ?? null) ?? undefined)

const customMasks = ref<AdminCustomPhotoMask[]>([])

onMounted(async () => {
  try {
    customMasks.value = await adminCustomPhotoMasksApi.list()
  } catch {
    customMasks.value = []
  }
})

function isActiveCustomMask(custom: AdminCustomPhotoMask): boolean {
  return activeMask.value?.type === 'custom' && activeMask.value.name === custom.name
}

function patchElement(patch: ElementPatch): void {
  if (!selected.value) {
    return
  }
  store.updateElement(selected.value.id, patch)
}

function selectNone(): void {
  patchElement({ mask: null })
}

function selectMask(type: Exclude<PhotoMaskType, 'custom'>): void {
  // Applying a (new) mask always re-fits the image to fully cover it, per spec — no empty gaps,
  // no stale framing from before the mask was picked.
  patchElement({
    mask: { type } satisfies PhotoMask,
    cropX: 0,
    cropY: 0,
    imageScale: 1,
    imageRotation: 0,
  })
}

function selectCustomMask(custom: AdminCustomPhotoMask): void {
  // Snapshot the catalog geometry into the element, same as PhotoFrameRef — never a live reference id.
  patchElement({
    mask: { type: 'custom', name: custom.name, points: custom.points } satisfies PhotoMask,
    cropX: 0,
    cropY: 0,
    imageScale: 1,
    imageRotation: 0,
  })
}
</script>

<style scoped lang="scss">
.editor-photo-mask-screen {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.editor-photo-mask-screen__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-2;
}

.editor-photo-mask-screen__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  gap: $spacing-1;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: center;
}

.editor-photo-mask-screen__thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid $border-light;
  border-radius: $radius-lg;
  background: $bg-elevated;
  box-shadow: $shadow-xs;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .editor-photo-mask-screen__card:hover & {
    border-color: $border-strong;
  }
}

.editor-photo-mask-screen__card--active .editor-photo-mask-screen__thumb {
  border-color: $text-primary;
  background: $bg-primary;
  box-shadow: $shadow-sm;
}

.editor-photo-mask-screen__check {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #ffffff;
  background: $text-primary;
  border-radius: 50%;
  padding: 1px;
}

.editor-photo-mask-screen__label {
  font-size: $font-size-caption;
  color: $text-secondary;
}

.editor-photo-mask-screen__card--active .editor-photo-mask-screen__label {
  color: $text-primary;
  font-weight: $font-weight-semibold;
}

.editor-photo-mask-screen__hint {
  margin: 0;
  font-size: $font-size-body-sm;
  color: $text-muted;
  line-height: 1.5;
}
</style>
