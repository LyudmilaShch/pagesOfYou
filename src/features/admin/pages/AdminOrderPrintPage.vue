<template>
  <div class="print-page">
    <div v-if="loadError" class="print-page__error">{{ loadError }}</div>
    <EditorCanvas v-else chromeless />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import EditorCanvas from '@/modules/editor/components/canvas/EditorCanvas.vue'
import { useEditorStore } from '@/modules/editor/store/editor.store'
import type { EditorSourceDocument } from '@/modules/editor/models/page-template.model'
import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'
import { ensureCustomFontsLoaded } from '@/modules/editor/utils/custom-fonts.util'
import { pendingImageLoads } from '@/modules/editor/utils/image-loading-tracker.util'
import { materializeCanvasData } from '@/features/order-builder/utils/merge-placeholder-element.util'
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

async function fetchDocument(): Promise<EditorSourceDocument> {
  const page = await adminOrdersApi.getJournalPage(orderId, journalPageId)
  return {
    id: page.id,
    name: page.magazinePage.name,
    pageType: page.slotType,
    canvasData: materializeCanvasData(normalizeCanvasData(page.pageSnapshot), page.placeholderValues),
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
  // Two animation frames: the first lets Vue's just-applied DOM/Konva draw calls actually paint;
  // the second confirms nothing else queued a further redraw off the back of that first paint
  // (e.g. a Konva image's onload firing a batchDraw in the same tick pendingImageLoads hit 0).
  await new Promise(requestAnimationFrame)
  await new Promise(requestAnimationFrame)
  window.__printReady = true
})

onMounted(async () => {
  try {
    const [, fonts] = await Promise.all([
      store.fetchAndLoad(fetchDocument, noopSave),
      ensureCustomFontsLoaded().then(() => document.fonts.ready),
    ])
    void fonts
    store.setPreviewMode(true)
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
