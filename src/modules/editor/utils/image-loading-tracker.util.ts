import { ref } from 'vue'

// Module-scope singleton, not a Pinia store — mirrors custom-fonts.util.ts's own reasoning: this
// needs to be readable from AdminOrderPrintPage.vue without that page needing to know anything
// about EditorElementNode.vue's internals, and a plain shared ref is simplest for that.
const pendingCount = ref(0)

/** How many `loadHtmlImage` calls (across every EditorElementNode.vue instance on the current
 * page) are still in flight — zero once every photo/frame image on the stage has actually
 * resolved. AdminOrderPrintPage.vue's screenshot-readiness gate waits on this reaching 0 instead
 * of guessing a settle delay, since a page can have several full-resolution photos still decoding
 * well after the initial Konva draw. */
export const pendingImageLoads = pendingCount

export function trackImageLoad<T>(promise: Promise<T>): Promise<T> {
  pendingCount.value += 1
  return promise.finally(() => {
    pendingCount.value -= 1
  })
}
