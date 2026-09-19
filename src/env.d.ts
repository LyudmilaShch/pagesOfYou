/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_YANDEX_MAPS_API_KEY?: string
  readonly VITE_CDEK_FROM_CITY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/** Global exposed by the CDEK widget CDN script (`https://cdn.jsdelivr.net/npm/@cdek-it/widget@4`)
 * — see `src/shared/config/cdek.ts` and `CheckoutPage.vue`. Typed loosely (the widget has no
 * published TS types); only the options this app actually passes are listed. */
interface CdekWidgetOptions {
  from: string
  root: string
  apiKey: string
  servicePath: string
  defaultLocation?: string
  canChoose?: boolean
  currency?: string
  lang?: 'rus' | 'eng'
  tariffs?: Record<string, unknown>
  hideFilters?: Record<string, unknown>
  goods?: Array<{ length: number; width: number; height: number; weight: number }>
  onCalculate?: (tariff: {
    tariff_code: number
    tariff_name: string
    delivery_mode?: number
    period_min: number
    period_max: number
    delivery_sum: number
  }) => void
  onChoose?: (
    mode: 'door' | 'office',
    tariff: { delivery_sum: number; period_min: number; period_max: number },
    address: {
      code?: string
      name?: string
      address?: string
      city?: string
      postal_code?: string
      location?: number[]
    },
  ) => void
}

interface Window {
  CDEKWidget?: new (options: CdekWidgetOptions) => unknown
}

declare module 'page-flip' {
  /** Payload page-flip passes to event handlers registered via `.on(name, cb)` — mirrors its own
   * `WidgetEvent` (see `node_modules/page-flip/src/Event/EventObject.ts`); `data`'s actual shape
   * depends on the event (e.g. a page index number for `'flip'`). */
  export interface PageFlipEvent {
    data: number | string | boolean | object
    object: PageFlip
  }

  /** The book's actual computed/rendered rect (see BasicTypes.ts) — `left`/`top`/`width`/`height`
   * are pixels relative to the block element (getUI().getDistElement(), which sizes itself flush
   * against the root element passed to `new PageFlip(...)`) — NOT necessarily the same box as
   * that root element itself, since page-flip letterboxes the actual pages within it when the
   * aspect ratio doesn't match exactly. */
  export interface PageRect {
    left: number
    top: number
    width: number
    height: number
    pageWidth: number
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>)
    loadFromImages(images: string[]): void
    /** HTML mode — takes the pages' own DOM elements and REPARENTS them (appendChild) into its
     * internal wrapper. Only reactive Vue content rendered into these elements via `<Teleport>`
     * survives that move cleanly (a plain v-for owned by the calling component's own template
     * would fight page-flip over the nodes' position on the next render). */
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    destroy(): void
    update(): void
    getRender(): unknown
    /** Animated. */
    flipNext(): void
    /** Animated. */
    flipPrev(): void
    /** Instant, no animation. */
    turnToPage(page: number): void
    getCurrentPageIndex(): number
    getPageCount(): number
    getBoundsRect(): PageRect
    on(eventName: string, callback: (e: PageFlipEvent) => void): PageFlip
    off(eventName: string): void
  }
}
