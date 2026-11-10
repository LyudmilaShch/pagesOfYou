export interface PhotoDropTarget {
  pageId: string
  elementId: string
}

/** The node under a finger, or anything that can answer `closest` the same way. */
export interface PhotoDropHitSource {
  closest(selector: string): { dataset: DOMStringMap | Record<string, string | undefined> } | null
}

/** Reads the journal page and photo slot under a touch point. Both data attributes have to
 * sit on the element that was hit or on one of its ancestors — the book stamps `data-page-id`
 * on the page window and `data-element-id` on the photo slot. */
export function readPhotoDropTarget(source: PhotoDropHitSource | null): PhotoDropTarget | null {
  if (!source) {
    return null
  }
  const elementId = source.closest('[data-element-id]')?.dataset.elementId
  const pageId = source.closest('[data-page-id]')?.dataset.pageId
  if (!elementId || !pageId) {
    return null
  }
  return { pageId, elementId }
}
