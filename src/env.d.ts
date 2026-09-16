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
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>)
    loadFromImages(images: string[]): void
    destroy(): void
    update(): void
    getRender(): unknown
  }
}
