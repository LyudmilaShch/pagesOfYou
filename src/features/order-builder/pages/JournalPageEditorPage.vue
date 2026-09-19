<template>
  <div v-if="store.loading && !store.document" class="journal-page-editor__loading">
    <v-progress-circular indeterminate color="primary" />
    <p>Загрузка страницы…</p>
  </div>

  <div v-else-if="loadError" class="journal-page-editor__loading">
    <v-icon size="40" color="error">mdi-alert-circle-outline</v-icon>
    <p>{{ loadError }}</p>
    <v-btn variant="outlined" :to="{ name: 'create-order' }">Начать заново</v-btn>
  </div>

  <EditorPage v-else />

  <v-snackbar v-model="submitSnackbar.show" :color="submitSnackbar.color" location="bottom center" :timeout="3000">
    {{ submitSnackbar.text }}
  </v-snackbar>

  <PhotoGalleryPickerDialog
    :open="photoPickerState.open"
    :scope="getGalleryScope(orderBuilderStore)"
    @select="handlePhotoPickerSelect"
    @close="handlePhotoPickerClose"
  />

  <AuthModal
    :open="authModalState.open"
    message="Чтобы оформить заказ, войдите в аккаунт"
    @success="handleAuthSuccess"
    @close="handleAuthClose"
  />

  <MissingContentModal
    :open="missingContentModal.open"
    :pages="missingContentModal.pages"
    @close="missingContentModal.open = false"
    @go-to-page="goToIncompletePage"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EditorPage from '@/modules/editor/pages/EditorPage.vue'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import type { EditorSourceDocument } from '@/modules/editor/models/page-template.model'
import { normalizeCanvasData, type CanvasData } from '@/modules/editor/models/canvas-data.model'
import { ensureCustomFontsLoaded } from '@/modules/editor/utils/custom-fonts.util'
import { provideEditorAssets } from '@/modules/editor/services/editor-assets'
import { provideEditorLeftPanelExtraCategories } from '@/modules/editor/services/editor-left-panel-extra-category'
import { provideEditorTopAction } from '@/modules/editor/services/editor-top-action'
import { provideEditorPhotoPicker } from '@/modules/editor/services/editor-photo-picker'
import { provideEditorPlaceholderSync } from '@/modules/editor/services/editor-placeholder-sync'
import { findNodeById } from '@/modules/editor/utils/element-tree.util'
import { useAuthStore } from '@/stores/auth.store'
import AuthModal from '@/components/auth/AuthModal.vue'
import { userEditorAssetsProvider } from '../services/user-editor-assets'
import { ordersApi } from '../api/orders.api'
import { useOrderBuilderStore } from '../stores/order-builder.store'
import { materializeCanvasData } from '../utils/merge-placeholder-element.util'
import { getGalleryScope } from '../utils/photo-gallery-scope.util'
import JournalStructurePanel from '../components/JournalStructurePanel.vue'
import QuestionnaireEntryPanel from '../components/QuestionnaireEntryPanel.vue'
import PhotoGalleryPanel from '../components/PhotoGalleryPanel.vue'
import PhotoGalleryPickerDialog from '../components/PhotoGalleryPickerDialog.vue'
import MissingContentModal from '../components/MissingContentModal.vue'

const route = useRoute()
const router = useRouter()
const store = useEditorStore()
const orderBuilderStore = useOrderBuilderStore()
const authStore = useAuthStore()
const loadError = ref<string | null>(null)

const submitSnackbar = reactive({
  show: false,
  text: '',
  color: 'success' as 'success' | 'error',
})

// Reactive, not a plain const: the "Структура" panel navigates between pages by changing
// :journalPageId on this same route rather than remounting this component (see below), so these
// must track the live route rather than freeze at first mount.
const orderId = computed(() => route.params.orderId as string)
const journalPageId = computed(() => route.params.journalPageId as string)

// Promise-based bridge to <AuthModal> below — same pattern as the photo picker: `requireAuth()`
// resolves `true` once the user has (or already had) a session, `false` if they closed the modal
// without signing in.
const authModalState = reactive<{
  open: boolean
  resolve: ((success: boolean) => void) | null
}>({
  open: false,
  resolve: null,
})

function requireAuth(): Promise<boolean> {
  if (authStore.isAuthenticated) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    authModalState.resolve = resolve
    authModalState.open = true
  })
}

function handleAuthSuccess(): void {
  authModalState.open = false
  authModalState.resolve?.(true)
  authModalState.resolve = null
}

const missingContentModal = reactive<{
  open: boolean
  pages: Array<{ journalPageId: string; pageLabel: string; missingLabels: string[] }>
}>({
  open: false,
  pages: [],
})

/** The submit flow already flushes the current page's unsaved edits before validating (see
 * `handleSubmitOrder`), so no explicit save is needed before jumping to a different page here. */
function goToIncompletePage(targetJournalPageId: string): void {
  missingContentModal.open = false
  void router.push({
    name: 'journal-page-editor',
    params: { orderId: orderId.value, journalPageId: targetJournalPageId },
  })
}

function handleAuthClose(): void {
  authModalState.open = false
  authModalState.resolve?.(false)
  authModalState.resolve = null
}

/** Top-bar "Оформить заказ" action (replaces the plain "Сохранить" button for this route) —
 * flushes the currently open page first, same as the old left-panel submit button did. A guest
 * (local draft) must sign in before the order can actually be created on the server — see
 * `requireAuth()` above and `convertLocalDraftToOrder()` in order-builder.store.ts. Once a real
 * order exists, this hands off to the checkout page (`CheckoutPage.vue`) — the actual
 * DRAFT → SUBMITTED transition happens there, after delivery/promo-code details are filled in. */
async function handleSubmitOrder(): Promise<void> {
  try {
    if (store.isDirty) {
      await store.saveCanvas()
    }

    const validationError = orderBuilderStore.getSubmitValidationError()
    if (validationError) {
      const incompletePages = orderBuilderStore.collectIncompletePages()
      if (incompletePages.length > 0) {
        missingContentModal.pages = incompletePages
        missingContentModal.open = true
      } else {
        // Not a per-page content issue (e.g. too few spreads) — a plain message is enough.
        submitSnackbar.text = validationError
        submitSnackbar.color = 'error'
        submitSnackbar.show = true
      }
      return
    }

    if (orderBuilderStore.isLocalDraft) {
      const authenticated = await requireAuth()
      if (!authenticated) {
        // The user closed the modal without signing in — not an error, just stop quietly.
        return
      }
    }

    if (orderBuilderStore.isLocalDraft) {
      await orderBuilderStore.convertLocalDraftToOrder()
    }

    if (!orderBuilderStore.order) {
      return
    }

    // Final submission (DRAFT → SUBMITTED) now happens at the end of the checkout page, after
    // delivery details and an optional promo code are in — see CheckoutPage.vue.
    await router.push({ name: 'order-checkout', params: { orderId: orderBuilderStore.order.id } })
  } catch {
    submitSnackbar.text = orderBuilderStore.orderError ?? 'Проверьте обязательные поля'
    submitSnackbar.color = 'error'
    submitSnackbar.show = true
  }
}

// Promise-based bridge to <PhotoGalleryPickerDialog> below — EditorPropertiesPanel.vue (in
// modules/editor, order-agnostic) calls `editorPhotoPicker.open()` without knowing this dialog
// exists; resolving the returned promise is how it finds out what (if anything) got picked.
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

// Runs once, synchronously, in this component's own setup — not inside onMounted — because
// EditorLeftPanel (a child, mounted before this component's onMounted fires) reads the extra
// category once at its own setup() time to decide its default open panel.
provideEditorAssets(userEditorAssetsProvider)
provideEditorLeftPanelExtraCategories([
  { key: 'structure', label: 'Структура', icon: 'mdi-view-sequential-outline', panel: JournalStructurePanel },
  { key: 'questionnaire', label: 'Анкета', icon: 'mdi-clipboard-text-outline', panel: QuestionnaireEntryPanel },
  { key: 'gallery', label: 'Галерея', icon: 'mdi-image-multiple-outline', panel: PhotoGalleryPanel },
])
provideEditorTopAction({
  label: 'Оформить заказ',
  icon: 'mdi-cart-outline',
  isLoading: () => orderBuilderStore.isSubmitting,
  isDisabled: () => orderBuilderStore.isSaving,
  onClick: handleSubmitOrder,
})
provideEditorPhotoPicker({ open: openPhotoPicker })

// Snapshot of each element's PlaceholderValue.source, taken from the currently-loaded order — not
// live-tracked (see editor-placeholder-sync.ts's doc comment for why). Re-derives whenever the
// "Структура" panel switches :journalPageId on this same route instance.
const placeholderSourceByElementId = computed(() => {
  const map = new Map<string, 'AUTO' | 'AI' | 'OVERRIDDEN'>()
  const page = orderBuilderStore.order?.journalPages.find((p) => p.id === journalPageId.value)
  for (const value of page?.placeholderValues ?? []) {
    map.set(value.elementId, value.source)
  }
  return map
})

/** "Обновить из анкеты" — pulls the current questionnaire answer for this element's questionKey
 * straight into the live canvas element. Purely a client-side patch (rides the next normal
 * autosave like any other edit) — no backend call, the answer is already in orderBuilderStore. */
function revertToAnswer(elementId: string): boolean {
  const element = store.document && findNodeById(store.document.canvasData.elements, elementId)
  if (!element || !('questionKey' in element) || !element.questionKey) {
    return false
  }

  const answer = orderBuilderStore.order?.questionAnswers.find(
    (a) => a.questionKey === element.questionKey,
  )
  if (!answer) {
    return false
  }

  if (element.type === 'photo-placeholder') {
    if (!answer.jsonValue?.url) {
      return false
    }
    store.updateElement(elementId, { defaultImageUrl: answer.jsonValue.url })
  } else {
    if (!answer.textValue?.trim()) {
      return false
    }
    store.updateElement(elementId, { defaultText: answer.textValue })
  }

  return true
}

async function regenerateAiText(elementId: string): Promise<string> {
  const text = await ordersApi.regenerateAiText(orderId.value, journalPageId.value, elementId)
  store.updateElement(elementId, { previewPlaceholderText: text })
  return text
}

provideEditorPlaceholderSync({
  get sourceByElementId() {
    return placeholderSourceByElementId.value
  },
  revertToAnswer,
  regenerateAiText,
})

/** Ensures order-builder.store holds the order this route points at — it's the single source of
 * truth both this editor and the "Структура" rail panel read/write, regardless of entry path
 * (fresh local draft carried over from CreateOrderPage, or a real order opened by direct URL). */
async function ensureOrderLoaded(): Promise<void> {
  if (orderBuilderStore.order?.id === orderId.value) {
    return
  }

  if (orderId.value.startsWith('local-')) {
    throw new Error(
      'Черновик заказа был потерян (например, из-за обновления страницы) — начните заново.',
    )
  }

  await orderBuilderStore.loadOrder(orderId.value)
}

async function fetchDocument(): Promise<EditorSourceDocument> {
  await ensureOrderLoaded()

  const journalPage = orderBuilderStore.order?.journalPages.find(
    (page) => page.id === journalPageId.value,
  )
  if (!journalPage) {
    throw new Error('Страница не найдена в этом заказе.')
  }

  const canvasData = materializeCanvasData(
    normalizeCanvasData(journalPage.pageSnapshot),
    journalPage.placeholderValues,
  )

  return {
    id: journalPage.id,
    name: journalPage.magazinePage.name,
    pageType: journalPage.slotType,
    canvasData,
  }
}

async function saveDocument(canvasData: CanvasData): Promise<void> {
  if (!orderBuilderStore.isLocalDraft) {
    await ordersApi.saveJournalPageCanvas(orderId.value, journalPageId.value, canvasData)
  }

  // Keeps the Структура panel (same store, same tab) current without a separate refetch — for a
  // local draft this *is* the save.
  orderBuilderStore.applyJournalPageCanvasEdit(journalPageId.value, canvasData)
}

async function loadCurrentPage(): Promise<void> {
  // A pending autosave from the page just left would otherwise fire later against whatever page
  // happens to be open by then — harmless (saveCanvas always reads the live document) but wasteful.
  clearAutosaveTimer()
  loadError.value = null

  try {
    await store.fetchAndLoad(fetchDocument, saveDocument)
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (err instanceof Error ? err.message : 'Не удалось загрузить страницу')
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
// different route component — Vue Router reuses this component instance for that (by design, and
// deliberately not forced otherwise: see EditorLayout.vue's router-view), so the reload has to be
// driven explicitly rather than relying on onMounted to re-fire.
watch(journalPageId, () => {
  void loadCurrentPage()
})

// Autosave — this route has no manual "save and leave" step of its own (unlike the admin editor,
// which relies on the user remembering to click Save), so unsaved advanced edits must reach the
// backend on their own. `isDirty` only flips false→true once per edit *run* (it stays true across
// further edits until a save clears it), but that's enough: the scheduled save always reads the
// live document at fire time, so it captures everything typed since the flip, and the very next
// edit after a save re-triggers the cycle.
const AUTOSAVE_DEBOUNCE_MS = 2500
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function clearAutosaveTimer(): void {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
}

function flushAutosaveNow(): void {
  clearAutosaveTimer()
  if (store.isDirty) {
    void store.saveCanvas()
  }
}

watch(
  () => store.isDirty,
  (isDirty) => {
    if (!isDirty) {
      return
    }

    clearAutosaveTimer()
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      void store.saveCanvas()
    }, AUTOSAVE_DEBOUNCE_MS)
  },
)

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    flushAutosaveNow()
  }
}

function handleBeforeUnload(): void {
  flushAutosaveNow()
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  provideEditorLeftPanelExtraCategories([])
  provideEditorTopAction(null)
  provideEditorPhotoPicker(null)
  provideEditorPlaceholderSync(null)
  // Best-effort save of any pending edit before tearing down — `store.saveCanvas()` reads
  // `document.value.canvasData` synchronously before its first await, so kicking off the request
  // here (without awaiting it) still captures the latest state even though `reset()` runs right
  // after.
  clearAutosaveTimer()
  if (store.isDirty) {
    void store.saveCanvas()
  }
  store.reset()
})
</script>

<style scoped lang="scss">
.journal-page-editor__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  min-height: calc(100vh - 64px);
  color: $text-secondary;
}
</style>
