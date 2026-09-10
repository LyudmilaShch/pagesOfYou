<template>
  <div v-if="store.loading && !store.document" class="admin-order-page-editor__loading">
    <v-progress-circular indeterminate color="primary" />
    <p>Загрузка страницы…</p>
  </div>

  <div v-else-if="loadError" class="admin-order-page-editor__loading">
    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
    <p>{{ loadError }}</p>
    <v-btn variant="outlined" :to="{ name: 'admin-order-detail', params: { id: orderId } }">К заказу</v-btn>
  </div>

  <EditorPage v-else />

  <AdminPhotoGalleryPickerDialog
    :open="photoPickerState.open"
    :order-id="orderId"
    @select="handlePhotoPickerSelect"
    @close="handlePhotoPickerClose"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import EditorPage from '@/modules/editor/pages/EditorPage.vue'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import type { EditorSourceDocument } from '@/modules/editor/models/page-template.model'
import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import { ensureCustomFontsLoaded } from '@/modules/editor/utils/custom-fonts.util'
import { provideEditorLeftPanelExtraCategories } from '@/modules/editor/services/editor-left-panel-extra-category'
import { provideEditorPhotoPicker } from '@/modules/editor/services/editor-photo-picker'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
import { adminOrdersApi } from '@/shared/api/admin/orders.api'
import { useAdminOrdersStore } from '../stores/orders.store'
import AdminOrderStructurePanel from '../components/AdminOrderStructurePanel.vue'
import AdminPhotoGalleryPanel from '../components/AdminPhotoGalleryPanel.vue'
import AdminPhotoGalleryPickerDialog from '../components/AdminPhotoGalleryPickerDialog.vue'

const route = useRoute()
const store = useEditorStore()
const adminOrdersStore = useAdminOrdersStore()
const loadError = ref<string | null>(null)

// Reactive, not plain consts: the "Структура" panel navigates between pages by changing
// :journalPageId on this same route rather than remounting this component (see EditorLayout.vue's
// router-view), so these must track the live route rather than freeze at first mount.
const orderId = computed(() => route.params.orderId as string)
const journalPageId = computed(() => route.params.journalPageId as string)

// Runs once, synchronously, in this component's own setup — not inside onMounted — because
// EditorLeftPanel (a child, mounted before this component's onMounted fires) reads the extra
// category once at its own setup() time to decide its default open panel.
provideEditorLeftPanelExtraCategories([
  { key: 'structure', label: 'Структура', icon: 'mdi-view-sequential-outline', panel: AdminOrderStructurePanel },
  { key: 'gallery', label: 'Галерея', icon: 'mdi-image-multiple-outline', panel: AdminPhotoGalleryPanel },
])

// Promise-based bridge to <AdminPhotoGalleryPickerDialog> above — mirrors the customer-facing
// `JournalPageEditorPage.vue`'s `openPhotoPicker()`: EditorPropertiesPanel.vue calls
// `editorPhotoPicker.open()` without knowing this dialog exists.
const photoPickerState = reactive<{
  open: boolean
  resolve: ((url: string | null) => void) | null
}>({
  open: false,
  resolve: null,
})

function openPhotoPicker(): Promise<string | null> {
  return new Promise((resolve) => {
    photoPickerState.resolve = resolve
    photoPickerState.open = true
  })
}

function handlePhotoPickerSelect(url: string): void {
  photoPickerState.open = false
  photoPickerState.resolve?.(url)
  photoPickerState.resolve = null
}

function handlePhotoPickerClose(): void {
  photoPickerState.open = false
  photoPickerState.resolve?.(null)
  photoPickerState.resolve = null
}

provideEditorPhotoPicker({ open: openPhotoPicker })

/** Ensures the admin orders store holds the order this route points at — the "Структура" rail
 * panel reads the journal page list from it, mirroring `JournalPageEditorPage.vue`'s
 * `ensureOrderLoaded`. */
async function ensureOrderLoaded(): Promise<void> {
  if (adminOrdersStore.current?.id === orderId.value) {
    return
  }

  await adminOrdersStore.loadOrder(orderId.value)
}

async function fetchDocument(): Promise<EditorSourceDocument> {
  await ensureOrderLoaded()

  const page = await adminOrdersApi.getJournalPage(orderId.value, journalPageId.value)

  return {
    id: page.id,
    name: page.magazinePage.name,
    pageType: page.slotType,
    canvasData: materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues),
  }
}

async function saveDocument(canvasData: CanvasData): Promise<void> {
  await adminOrdersApi.saveJournalPageCanvas(orderId.value, journalPageId.value, canvasData)
}

async function loadCurrentPage(): Promise<void> {
  loadError.value = null

  try {
    await store.fetchAndLoad(fetchDocument, saveDocument)
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Не удалось загрузить страницу'
    loadError.value = message
  }
}

onMounted(async () => {
  // Runs alongside the page fetch below, not blocking it — the font picker fills in reactively
  // once this resolves (mirrors MagazinePageEditorPage.vue).
  const fontsReady = ensureCustomFontsLoaded()

  await loadCurrentPage()

  void fontsReady.then(() => store.recalculateAllTextElementSizes())
})

// The "Структура" panel switches :journalPageId on this same route instead of navigating to a
// different route component — Vue Router reuses this component instance for that, so the reload
// has to be driven explicitly rather than relying on onMounted to re-fire.
watch(journalPageId, () => {
  void loadCurrentPage()
})

onUnmounted(() => {
  provideEditorLeftPanelExtraCategories([])
  provideEditorPhotoPicker(null)
  store.reset()
})
</script>

<style scoped lang="scss">
.admin-order-page-editor__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  min-height: calc(100vh - 64px);
  color: $text-secondary;
}
</style>
