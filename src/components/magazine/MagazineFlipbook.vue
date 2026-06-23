<template>
  <div ref="flipbookRootRef" class="magazine-flipbook">
    <div ref="bookContainerRef" class="magazine-flipbook__book" />
  </div>
</template>

<script setup lang="ts">
import { PageFlip } from 'page-flip'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const MAGAZINE_PAGE_COUNT = 20
const MAGAZINE_MAX_WIDTH = 900

const magazinePages = Array.from(
  { length: MAGAZINE_PAGE_COUNT },
  (_, index) => `/images/girlMagazine/${index + 1}page.png`,
)

const flipbookRootRef = ref<HTMLElement | null>(null)
const bookContainerRef = ref<HTMLElement | null>(null)

let pageFlip: PageFlip | null = null
let resizeObserver: ResizeObserver | null = null

const getContainerSize = () => {
  const rootEl = flipbookRootRef.value
  if (!rootEl) return null

  const { width, height } = rootEl.getBoundingClientRect()
  if (width < 1 || height < 1) return null

  return {
    width: Math.min(width, MAGAZINE_MAX_WIDTH),
    height,
  }
}

const MODAL_BG = '#f8f7f4'

const patchCanvasBackground = () => {
  if (!pageFlip) return

  const render = pageFlip.getRender() as {
    clear: () => void
    ctx: CanvasRenderingContext2D
    canvas: HTMLCanvasElement
  }

  render.clear = function clearWithModalBackground() {
    render.ctx.fillStyle = MODAL_BG
    render.ctx.fillRect(0, 0, render.canvas.width, render.canvas.height)
  }
}

const initPageFlip = () => {
  const bookEl = bookContainerRef.value
  if (!bookEl || pageFlip) return

  const size = getContainerSize()
  if (!size) return

  pageFlip = new PageFlip(bookEl, {
    width: 550,
    height: 733,
    size: 'stretch',
    minWidth: 200,
    maxWidth: size.width,
    minHeight: 200,
    maxHeight: size.height,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: true,
    autoSize: true,
    drawShadow: true,
    maxShadowOpacity: 1,
    flippingTime: 700,
    useMouseEvents: true,
  })

  pageFlip.loadFromImages(magazinePages)
  patchCanvasBackground()
  pageFlip.update()
}

const refreshPageFlip = () => {
  if (!pageFlip) {
    initPageFlip()
    return
  }

  pageFlip.update()
}

onMounted(async () => {
  await nextTick()
  requestAnimationFrame(() => {
    initPageFlip()
  })

  if (!flipbookRootRef.value) return

  resizeObserver = new ResizeObserver(() => {
    refreshPageFlip()
  })
  resizeObserver.observe(flipbookRootRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  pageFlip?.destroy()
  pageFlip = null
})
</script>

<style scoped lang="scss">
.magazine-flipbook {
  width: 100%;
  height: 100%;
  min-height: 280px;
  margin-inline: auto;

  &__book {
    width: 100%;
    height: 100%;
    max-width: 900px;
    margin-inline: auto;
    background: transparent;
    box-shadow: none;
  }

  :deep(.stf__parent) {
    background: transparent;
    box-shadow: none;
  }
}
</style>
