<template>
  <div class="print-page">
    <div v-if="loadError" class="print-page__error">{{ loadError }}</div>
    <EditorCanvas v-else-if="showCanvas" chromeless />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import EditorCanvas from '@/modules/editor/components/canvas/EditorCanvas.vue'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import type { EditorSourceDocument } from '@/modules/editor/models/page-template.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import {
  collectFontFamilies,
  ensureCustomFontsLoaded,
  loadFontFamiliesForMeasure,
} from '@/modules/editor/utils/custom-fonts.util'
import { remeasureRenderedText } from '@/modules/editor/utils/text-measure.util'
import { pendingImageLoads } from '@/modules/editor/utils/image-loading-tracker.util'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
import { tocEntriesForPage } from '@/features/order-builder/utils/journal-structure.util'
import { adminOrdersApi } from '@/shared/api/admin/orders.api'
import { ADMIN_TOKEN_KEY } from '../api/admin-http'

declare global {
  interface Window {
    /** Set once by this page, read by backend/src/modules/pdf-export/pdf-export.service.ts's
     * Puppeteer `page.waitForFunction('window.__printReady === true')` — the signal that the
     * stage is fully laid out (fonts, every photo, zero zoom/pan drift) and safe to screenshot. */
    __printReady?: boolean
  }
}

// Not a logged-in admin session — this route is only ever opened by the backend's own headless
// Puppeteer export, carrying a short-lived export token in the query string (see
// PdfExportService.mintExportToken). Writing it into the SAME localStorage key the normal admin
// session uses is what makes the existing adminHttp instance (and every *.api.ts built on it)
// authenticate this page's requests with zero extra plumbing — see admin-http.ts's own interceptor.
const route = useRoute()
const orderId = route.params.orderId as string
const journalPageId = route.params.journalPageId as string
const token = route.query.token as string | undefined
if (token) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

const store = useEditorStore()
const loadError = ref<string | null>(null)
const showCanvas = ref(false)

async function fetchDocument(): Promise<EditorSourceDocument> {
  const order = await adminOrdersApi.getOne(orderId)
  const page = order.journalPages.find((item) => item.id === journalPageId)
  if (!page) {
    throw new Error('Страница не найдена в этом заказе.')
  }
  return {
    id: page.id,
    name: page.magazinePage.name,
    pageType: page.slotType,
    canvasData: materializeCanvasData(
      normalizeCanvasData(page.pageSnapshot),
      page.placeholderValues,
      undefined,
      tocEntriesForPage(order.journalPages, page.id),
    ),
  }
}

// Print views never save — previewMode (set below) already blocks every mutation path that would
// call this, it's here only because fetchAndLoad's signature requires a save function.
async function noopSave(): Promise<void> {}

const fontsReady = ref(false)
const imagesSettled = computed(() => fontsReady.value && pendingImageLoads.value === 0)

watch(imagesSettled, async (ready) => {
  if (!ready) {
    return
  }
  // Line breaks are cached on the text node. Measure once the faces and photos are in,
  // then let Konva paint that layout before the screenshot.
  await nextTick()
  remeasureRenderedText()
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  window.__printReady = true
})

onMounted(async () => {
  // Screenshot the saved frame. Do not refit fonts or move boxes while printing.
  store.setTextFitMode('grow')
  try {
    const [doc] = await Promise.all([fetchDocument(), ensureCustomFontsLoaded()])
    // Konva freezes line breaks on the first measure. Request every face first, then mount
    // the canvas, so the screenshot wraps the way the author saw it.
    await loadFontFamiliesForMeasure(collectFontFamilies(doc.canvasData.elements))
    showCanvas.value = true
    await nextTick()
    await store.fetchAndLoad(async () => doc, noopSave)
    store.setPreviewMode(true)
    // Let photo loads register before the ready watch. That watch is the only remeasure.
    await nextTick()
    fontsReady.value = true
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'Не удалось загрузить страницу'
    loadError.value = message
  }
})

onUnmounted(() => {
  store.reset()
})
</script>

<style scoped lang="scss">
// Fills exactly whatever viewport Puppeteer set (page.setViewport, matched to the journal page's
// own physical size — see pdfExportService's pageDimensions) — no page-level scroll/margins to
// throw off a screenshot meant to be the page itself, pixel for pixel.
.print-page {
  width: 100vw;
  height: 100vh;
  margin: 0;
  background: #fff;
  overflow: hidden;
}

.print-page__error {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: red;
  font-family: monospace;
}
</style>
