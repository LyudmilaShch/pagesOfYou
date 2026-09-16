import { getApiBaseUrl } from './api'

/** Yandex Maps API key the CDEK widget needs to render its map — empty until you get one
 * (`VITE_YANDEX_MAPS_API_KEY`). `isCdekWidgetConfigured()` gates the widget's mount so the
 * checkout page shows a clear "not configured yet" message instead of a broken map. */
export function getYandexMapsApiKey(): string {
  return import.meta.env.VITE_YANDEX_MAPS_API_KEY?.trim() ?? ''
}

export function getCdekFromCity(): string {
  return import.meta.env.VITE_CDEK_FROM_CITY?.trim() || 'Москва'
}

/** Our backend proxy (`CdekController`) — the widget calls this directly from the browser, not
 * through the app's normal authenticated axios client. */
export function getCdekServicePath(): string {
  return `${getApiBaseUrl()}/delivery/cdek/service`
}

export function isCdekWidgetConfigured(): boolean {
  return getYandexMapsApiKey().length > 0
}

export const CDEK_WIDGET_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@cdek-it/widget@4'
