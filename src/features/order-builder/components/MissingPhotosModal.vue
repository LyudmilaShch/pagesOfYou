<template>
  <BaseModal :model-value="open" labelledby="missing-photos-title" wide @update:model-value="handleOverlayUpdate">
    <div class="missing-photos">
      <div class="missing-photos__book-column" aria-label="Развороты журнала">
        <QuestionnaireBook
          :pages="store.order?.journalPages ?? []"
          :canvas-data-by-page-id="canvasDataByPageId"
          :focus-page-id="focusPageId"
          :pulsing-page-ids="pulsingPageIds"
          :fill-by-page-id="EMPTY_FILL_MAP"
          :pending-element-ids="EMPTY_ELEMENT_IDS"
          :drop-enabled="manualPlacementMode"
          :show-structure-controls="false"
          pick-enabled
          @drop-photo="handleDropPhoto"
          @pick-photo="openPhotoPicker"
        />
      </div>

      <div class="missing-photos__main">
        <div class="missing-photos__scroll">
          <h2 id="missing-photos-title" class="missing-photos__title">
            {{ hasEmptySlots ? `Не хватает ${missingPhotoCount} фото` : 'Все фото на месте' }}
          </h2>
          <p class="missing-photos__subtitle">
            <template v-if="hasEmptySlots">
              Загрузите ещё — они сами лягут в свободные слоты, а если что-то не так, перетащите фото
              на нужное место в развороте слева.
            </template>
            <template v-else>
              Можно продолжать оформление заказа — или ещё что-то поправить перед этим.
            </template>
          </p>

          <div
            class="missing-photos__dropzone"
            :class="{ 'missing-photos__dropzone--active': isDragActive }"
            role="button"
            tabindex="0"
            @dragover.prevent="isDragActive = true"
            @dragleave.prevent="isDragActive = false"
            @drop.prevent="handleDrop"
            @click="fileInputRef?.click()"
            @keydown.enter="fileInputRef?.click()"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              multiple
              class="missing-photos__file-input"
              @change="handleFilesSelected"
              @click.stop
            />
            <span class="missing-photos__dropzone-icon">
              <v-progress-circular v-if="uploading" indeterminate size="16" width="2" color="primary" />
              <v-icon v-else size="16">mdi-arrow-up</v-icon>
            </span>
            <p class="missing-photos__dropzone-title">Перетащите фото сюда</p>
            <p class="missing-photos__dropzone-hint">или нажмите, чтобы выбрать с устройства</p>
          </div>

          <div class="missing-photos__stats">
            <span class="missing-photos__stats-count">Загружено {{ photos.length }} фото</span>
            <span class="missing-photos__stats-hint">Нужно {{ requiredPhotoCount }} фото</span>
          </div>

          <div v-if="coverSlots.length > 0" class="missing-photos__cover">
            <h3 class="missing-photos__cover-title">Фото на обложке</h3>
            <div class="missing-photos__cover-slots">
              <div v-for="slot in coverSlots" :key="slot.elementId" class="missing-photos__cover-slot">
                <div class="missing-photos__cover-preview">
                  <img v-if="slot.url" :src="slot.url" alt="" />
                  <v-icon v-else size="20" color="grey">mdi-image-outline</v-icon>
                </div>
                <v-btn variant="outlined" size="small" @click="openCoverPicker(slot.elementId)">
                  {{ slot.url ? 'Заменить' : 'Выбрать фото' }}
                </v-btn>
              </div>
            </div>
          </div>

          <div v-if="photos.length > 0" class="missing-photos__grid-header">
            <span class="missing-photos__grid-title">Загруженные фото</span>
            <v-btn
              variant="text"
              size="small"
              :color="manualPlacementMode ? 'primary' : undefined"
              @click="manualPlacementMode = !manualPlacementMode"
            >
              {{ manualPlacementMode ? 'Готово' : 'Расставить вручную' }}
            </v-btn>
          </div>
          <p v-if="manualPlacementMode" class="missing-photos__manual-hint">
            Перетащите фото на нужное место в развороте слева
          </p>

          <div v-if="photos.length > 0" class="missing-photos__grid">
            <div
              v-for="photo in photos"
              :key="photo.id"
              class="missing-photos__thumb"
              :class="{ 'missing-photos__thumb--draggable': manualPlacementMode }"
              :draggable="manualPlacementMode"
              @dragstart="handleDragStart($event, photo)"
            >
              <img :src="photo.url" :alt="photo.originalName ?? ''" />
              <button
                v-if="usageByUrl.get(photo.url)?.length"
                type="button"
                class="missing-photos__thumb-usage"
                :class="{ 'missing-photos__thumb-usage--multi': (usageByUrl.get(photo.url)?.length ?? 0) > 2 }"
                :aria-label="`Используется на ${usageByUrl.get(photo.url)?.length} страницах`"
                @click.stop="handleUsageClick(photo.url)"
              >
                <v-icon size="11">mdi-image-multiple</v-icon>
                {{ usageByUrl.get(photo.url)?.length }}
              </button>
              <button
                type="button"
                class="missing-photos__thumb-remove"
                aria-label="Удалить фото"
                @click="removePhoto(photo)"
              >
                <v-icon size="14">mdi-close</v-icon>
              </button>
            </div>
          </div>
        </div>

        <div class="missing-photos__footer">
          <v-btn
            color="primary"
            size="large"
            block
            class="missing-photos__cta"
            :disabled="hasEmptySlots"
            @click="emit('continue')"
          >
            Продолжить
          </v-btn>
        </div>
      </div>
    </div>

    <PhotoGalleryPickerDialog
      :open="pickerTarget !== null"
      :scope="galleryScope"
      @select="handlePickerSelect"
      @close="closePhotoPicker"
    />

    <v-dialog v-model="usageModalOpen" max-width="420">
      <v-card>
        <v-card-title class="missing-photos__usage-modal-title">
          Где используется фото
          <v-btn icon="mdi-close" variant="text" size="small" aria-label="Закрыть" @click="usageModalPhotoUrl = null" />
        </v-card-title>
        <v-card-text>
          <ul class="missing-photos__usage-list">
            <li v-for="entry in usageModalEntries" :key="entry.elementId">
              <button type="button" class="missing-photos__usage-item" @click="goToUsage(entry)">
                {{ entry.pageLabel }}
                <v-icon size="16">mdi-chevron-right</v-icon>
              </button>
            </li>
          </ul>
        </v-card-text>
      </v-card>
    </v-dialog>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { isPhotoElement } from '@/modules/editor/models'
import { flattenTree } from '@/modules/editor/utils/element-tree.util'
import { getImageDimensions } from '@/shared/utils/image-dimensions.util'
import { photoGalleryApi, type GalleryPhoto } from '../api/photo-gallery.api'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import { getGalleryScope } from '../utils/photo-gallery-scope.util'
import { getJournalPageDisplayName } from '../utils/journal-structure.util'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import { collectPhotoSlotPreview, countEmptyPhotoSlots } from '../utils/missing-photos.util'
import QuestionnaireBook from './questionnaire/QuestionnaireBook.vue'
import PhotoGalleryPickerDialog from './PhotoGalleryPickerDialog.vue'

// Same reasoning as PhotoUploadPage.vue's own stable-empty-instances comment — QuestionnaireBook's
// fill-badge/pending-AI props don't apply here, but they aren't optional props.
const EMPTY_FILL_MAP: Map<string, { answered: number; total: number }> = new Map()
const EMPTY_ELEMENT_IDS: Set<string> = new Set()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  continue: []
}>()

const store = useOrderBuilderStore()
const galleryScope = computed(() => getGalleryScope(store))

const photos = ref<GalleryPhoto[]>([])
const uploading = ref(false)
const isDragActive = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const manualPlacementMode = ref(false)

const missingPhotoCount = computed(() =>
  countEmptyPhotoSlots(collectPhotoSlotPreview(store.order?.journalPages ?? [])),
)
const hasEmptySlots = computed(() => missingPhotoCount.value > 0)

// Same definition PhotoUploadPage.vue uses — every photo-placeholder slot in the journal, not just
// the ones still empty, so the stats line reads the same way it did on Шаг 2.
const requiredPhotoCount = computed(() => {
  let count = 0
  for (const page of store.order?.journalPages ?? []) {
    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    count += leaves.filter((leaf) => isPhotoElement(leaf)).length
  }
  return count
})

interface CoverSlot {
  elementId: string
  url: string | null
}

const coverPage = computed(() => store.order?.journalPages.find((page) => page.slotType === 'COVER') ?? null)
const coverSlots = computed<CoverSlot[]>(() => {
  const page = coverPage.value
  if (!page) {
    return []
  }
  const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
  const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))
  return leaves
    .filter((leaf) => isPhotoElement(leaf))
    .map((leaf) => ({ elementId: leaf.id, url: valueByElementId.get(leaf.id)?.jsonValue?.url ?? null }))
})

// Picking a photo for a specific slot from the gallery — used by both the dedicated cover picker
// and the "add photo" button on any empty slot in the book (see `openPhotoPicker`/`pick-photo`).
const pickerTarget = ref<{ journalPageId: string; elementId: string } | null>(null)

function openCoverPicker(elementId: string): void {
  if (!coverPage.value) {
    return
  }
  openPhotoPicker(coverPage.value.id, elementId)
}

function openPhotoPicker(journalPageId: string, elementId: string): void {
  pickerTarget.value = { journalPageId, elementId }
}

function closePhotoPicker(): void {
  pickerTarget.value = null
}

async function handlePickerSelect(url: string): Promise<void> {
  const target = pickerTarget.value
  pickerTarget.value = null
  if (!target) {
    return
  }
  try {
    await store.savePlaceholders(target.journalPageId, [
      { elementId: target.elementId, valueType: 'PHOTO', jsonValue: { url } },
    ])
  } catch {
    // orderError is set in the store; the picker just closes either way.
  }
}

const focusPageId = ref<string | null>(null)
const pulsingPageIds = ref<Set<string>>(new Set())
let pulseTimer: ReturnType<typeof setTimeout> | null = null

function jumpTo(journalPageId: string): void {
  focusPageId.value = journalPageId
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
  pulsingPageIds.value = new Set([journalPageId])
  pulseTimer = setTimeout(() => {
    pulsingPageIds.value = new Set()
  }, 1500)
}

interface PhotoUsage {
  journalPageId: string
  elementId: string
  pageLabel: string
}

const usageByUrl = computed<Map<string, PhotoUsage[]>>(() => {
  const map = new Map<string, PhotoUsage[]>()
  const pages = store.order?.journalPages ?? []
  let spreadIndex = 0

  for (const page of pages) {
    if (page.slotType === 'SPREAD') {
      spreadIndex += 1
    }
    const pageLabel = getJournalPageDisplayName(page, spreadIndex)

    for (const value of page.placeholderValues) {
      const url = value.jsonValue?.url
      if (value.valueType !== 'PHOTO' || !url) {
        continue
      }
      const entry: PhotoUsage = { journalPageId: page.id, elementId: value.elementId, pageLabel }
      const list = map.get(url)
      if (list) {
        list.push(entry)
      } else {
        map.set(url, [entry])
      }
    }
  }
  return map
})

const usageModalPhotoUrl = ref<string | null>(null)
const usageModalOpen = computed({
  get: () => usageModalPhotoUrl.value !== null,
  set: (value: boolean) => {
    if (!value) {
      usageModalPhotoUrl.value = null
    }
  },
})
const usageModalEntries = computed<PhotoUsage[]>(
  () => (usageModalPhotoUrl.value ? usageByUrl.value.get(usageModalPhotoUrl.value) : undefined) ?? [],
)

function handleUsageClick(url: string): void {
  const usage = usageByUrl.value.get(url) ?? []
  if (usage.length === 1) {
    jumpTo(usage[0].journalPageId)
    return
  }
  if (usage.length > 1) {
    usageModalPhotoUrl.value = url
  }
}

function goToUsage(entry: PhotoUsage): void {
  jumpTo(entry.journalPageId)
  usageModalPhotoUrl.value = null
}

const canvasDataByPageId = computed(() => {
  const map = new Map<string, ReturnType<typeof materializeCanvasData>>()
  for (const page of store.order?.journalPages ?? []) {
    map.set(page.id, materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues))
  }
  return map
})

/** Mirrors PhotoUploadPage.vue's own `findNextEmptyAutoFillSlot` — skips COVER (that's the
 * dedicated picker above instead) and any slot already owned by a questionnaire question. */
function findNextEmptyAutoFillSlot(): { journalPageId: string; elementId: string } | null {
  for (const page of store.order?.journalPages ?? []) {
    if (page.slotType === 'COVER') {
      continue
    }
    const leaves = flattenTree(normalizeCanvasData(page.pageSnapshot).elements)
    const valueByElementId = new Map(page.placeholderValues.map((value) => [value.elementId, value]))

    for (const leaf of leaves) {
      if (!isPhotoElement(leaf) || leaf.questionKey) {
        continue
      }
      if (valueByElementId.get(leaf.id)?.jsonValue?.url?.trim()) {
        continue
      }
      return { journalPageId: page.id, elementId: leaf.id }
    }
  }
  return null
}

async function autoPlacePhoto(url: string): Promise<void> {
  const slot = findNextEmptyAutoFillSlot()
  if (!slot) {
    return
  }
  try {
    await store.savePlaceholders(slot.journalPageId, [
      { elementId: slot.elementId, valueType: 'PHOTO', jsonValue: { url } },
    ])
  } catch {
    // Best-effort — the photo is still safely in the gallery either way.
  }
}

async function uploadFiles(files: File[]): Promise<void> {
  if (files.length === 0) {
    return
  }

  uploading.value = true
  try {
    for (const file of files) {
      try {
        const dimensions = await getImageDimensions(file).catch(() => undefined)
        const uploaded = await photoGalleryApi.upload(galleryScope.value, file, dimensions)
        photos.value = [uploaded, ...photos.value]
        await autoPlacePhoto(uploaded.url)
      } catch {
        // Best-effort per file — a failed upload just doesn't get added.
      }
    }
  } finally {
    uploading.value = false
  }
}

function handleFilesSelected(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  void uploadFiles(files)
}

function handleDrop(event: DragEvent): void {
  isDragActive.value = false
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  void uploadFiles(files.filter((file) => file.type.startsWith('image/')))
}

function handleDragStart(event: DragEvent, photo: GalleryPhoto): void {
  if (!manualPlacementMode.value || !event.dataTransfer) {
    return
  }
  event.dataTransfer.setData('text/plain', photo.url)
  event.dataTransfer.effectAllowed = 'copy'
}

async function handleDropPhoto(pageId: string, elementId: string, url: string): Promise<void> {
  try {
    await store.savePlaceholders(pageId, [{ elementId, valueType: 'PHOTO', jsonValue: { url } }])
  } catch {
    // orderError is set in the store; nothing further to do here.
  }
}

async function removePhoto(photo: GalleryPhoto): Promise<void> {
  const previous = photos.value
  photos.value = photos.value.filter((item) => item.id !== photo.id)
  try {
    await photoGalleryApi.remove(photo.id, galleryScope.value)
  } catch {
    photos.value = previous
  }
}

async function loadPhotos(): Promise<void> {
  try {
    photos.value = await photoGalleryApi.list(galleryScope.value)
  } catch {
    photos.value = []
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void loadPhotos()
    } else {
      manualPlacementMode.value = false
    }
  },
  { immediate: true },
)

function handleOverlayUpdate(value: boolean): void {
  if (!value) {
    emit('close')
  }
}

onBeforeUnmount(() => {
  if (pulseTimer) {
    clearTimeout(pulseTimer)
  }
})
</script>

<style scoped lang="scss">
.missing-photos {
  display: flex;
  gap: $spacing-8;
  width: min(100%, 1140px);
  margin-inline: auto;

  @include mobile-only {
    flex-direction: column;
    gap: $spacing-4;
  }
}

.missing-photos__book-column {
  flex: 0 0 50%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  @include mobile-only {
    display: none;
  }
}

.missing-photos__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.missing-photos__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.missing-photos__footer {
  flex-shrink: 0;
  padding-top: $spacing-3;
}

.missing-photos__title {
  margin: 0 0 $spacing-2;
  font-family: $font-family-display;
  font-size: $font-size-h4;
  color: $text-primary;
}

.missing-photos__subtitle {
  margin: 0 0 $spacing-4;
  font-size: $font-size-body-sm;
  line-height: 1.5;
  color: $text-secondary;
}

.missing-photos__dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-2;
  padding: $spacing-4;
  border: 1.5px dashed $border-default;
  border-radius: $radius-lg;
  background: $bg-tertiary;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;

  &:hover,
  &--active {
    border-color: $accent;
    background: $accent-tint;
  }
}

.missing-photos__file-input {
  display: none;
}

.missing-photos__dropzone-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-bottom: $spacing-1;
  border-radius: 50%;
  border: 1.5px solid $border-default;
  background: $bg-elevated;
  color: $text-secondary;
}

.missing-photos__dropzone-title {
  margin: 0;
  font-weight: $font-weight-semibold;
  color: $text-primary;
  font-size: $font-size-body-sm;
}

.missing-photos__dropzone-hint {
  margin: 0;
  font-size: $font-size-caption;
  color: $text-secondary;
}

.missing-photos__stats {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: $spacing-3;
  margin-top: $spacing-4;
}

.missing-photos__stats-count {
  font-weight: $font-weight-semibold;
  color: $text-primary;
  font-size: $font-size-body-sm;
}

.missing-photos__stats-hint {
  font-size: $font-size-caption;
  color: $text-secondary;
}

.missing-photos__cover {
  margin-top: $spacing-4;
  padding-top: $spacing-4;
  border-top: 1px solid $border-light;
}

.missing-photos__cover-title {
  margin: 0 0 $spacing-3;
  font-size: $font-size-body-sm;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.missing-photos__cover-slots {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-4;
}

.missing-photos__cover-slot {
  display: flex;
  align-items: center;
  gap: $spacing-3;
}

.missing-photos__cover-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.missing-photos__grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-3;
  margin-top: $spacing-4;
}

.missing-photos__grid-title {
  font-size: $font-size-body-sm;
  color: $text-secondary;
}

.missing-photos__manual-hint {
  margin: $spacing-1 0 0;
  font-size: $font-size-caption;
  color: $text-secondary;
}

.missing-photos__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: $spacing-2;
  margin-top: $spacing-3;
}

.missing-photos__thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: $radius-md;
  overflow: hidden;
  background: $bg-muted;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &--draggable {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

.missing-photos__thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: rgba($black, 0.55);
  color: $white;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: rgba($black, 0.75);
  }
}

.missing-photos__thumb-usage {
  position: absolute;
  bottom: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  border: none;
  background: rgba($black, 0.6);
  color: $white;
  font-size: 9px;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover {
    background: rgba($black, 0.8);
  }

  &--multi {
    background: rgba(#e5484d, 0.9);

    &:hover {
      background: #e5484d;
    }
  }
}

.missing-photos__cta {
  text-transform: none;
}

.missing-photos__usage-modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.missing-photos__usage-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.missing-photos__usage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: $spacing-3 0;
  border: none;
  border-bottom: 1px solid $border-light;
  background: none;
  color: $text-primary;
  font-size: $font-size-body;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: $accent;
  }
}

.missing-photos__usage-list li:last-child .missing-photos__usage-item {
  border-bottom: none;
}
</style>
