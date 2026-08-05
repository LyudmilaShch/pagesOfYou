import { computed, ref } from 'vue'

import { fontsApi, type CustomFont } from '@/shared/api/fonts.api'
import { EDITOR_FONT_OPTIONS } from '../constants/page.constants'

export interface FontOption {
  title: string
  value: string
}

export type FontSelectItem = FontOption | { type: 'divider' } | { type: 'subheader'; title: string }

// Module-scope singleton, not a Pinia store — document.fonts is itself a global browser registry,
// and this needs to be importable from both editor.store.ts and order-builder.store.ts without
// creating a dependency between those two otherwise-independent stores.
const customFontOptions = ref<FontOption[]>([])
let loadPromise: Promise<void> | null = null

interface FontVariant {
  url: string | null
  weight: '400' | '700'
  style: 'normal' | 'italic'
  required: boolean
}

async function registerFontFace(
  family: string,
  variant: FontVariant & { url: string },
): Promise<boolean> {
  try {
    const face = new FontFace(family, `url(${variant.url})`, {
      weight: variant.weight,
      style: variant.style,
    })
    await face.load()
    document.fonts.add(face)
    return true
  } catch (error) {
    // A failed variant (e.g. a bad Bold file) must not block Regular, or any other font — just
    // skip this one face; the browser falls back to synthetic bold/italic for it.
    console.warn('[custom-fonts] failed to load font face', {
      family,
      weight: variant.weight,
      style: variant.style,
      error,
    })
    return false
  }
}

async function loadFont(font: CustomFont): Promise<FontOption | null> {
  const variants: FontVariant[] = [
    { url: font.regularFileUrl, weight: '400', style: 'normal', required: true },
    { url: font.boldFileUrl, weight: '700', style: 'normal', required: false },
    { url: font.italicFileUrl, weight: '400', style: 'italic', required: false },
    { url: font.boldItalicFileUrl, weight: '700', style: 'italic', required: false },
  ]

  let regularLoaded = false

  await Promise.all(
    variants
      .filter((variant): variant is FontVariant & { url: string } => variant.url != null)
      .map(async (variant) => {
        const loaded = await registerFontFace(font.fontFamily, variant)
        if (loaded && variant.required) {
          regularLoaded = true
        }
      }),
  )

  // A font only shows up in the picker once its Regular face has actually loaded — that's the
  // baseline everything else (including plain, non-bold/italic text) renders with.
  return regularLoaded ? { title: font.name, value: font.fontFamily } : null
}

async function doLoad(): Promise<void> {
  const fonts = await fontsApi.list().catch((error) => {
    console.warn('[custom-fonts] failed to fetch font list', error)
    return []
  })

  const settled = await Promise.allSettled(fonts.map(loadFont))
  customFontOptions.value = settled
    .filter(
      (result): result is PromiseFulfilledResult<FontOption | null> =>
        result.status === 'fulfilled',
    )
    .map((result) => result.value)
    .filter((value): value is FontOption => value !== null)

  // Make sure the canvas's own text-measuring (raw canvas measureText, unaware of load timing on
  // its own) only reads these fonts once they're truly ready.
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready
  }
}

/** Fetches + registers all active custom fonts (via the FontFace API), once — safe to call from
 * multiple entry points (admin template editor, order-builder fill, the admin fonts page itself);
 * later callers reuse the same in-flight/resolved promise. */
export function ensureCustomFontsLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = doLoad()
  }

  return loadPromise
}

/** Drops the cache and reloads — call after creating/editing a font in the admin panel so its
 * preview (and the editor dropdown, if open in the same session) picks up the change immediately. */
export function invalidateCustomFontsCache(): Promise<void> {
  loadPromise = null
  return ensureCustomFontsLoaded()
}

/** The 6 built-in fonts, plus (once loaded) any active custom fonts under a "Ваши шрифты" group —
 * Vuetify's v-select/v-list already understand the divider/subheader pseudo-items mixed into an
 * `items` array. */
export const mergedFontOptions = computed<FontSelectItem[]>(() => {
  if (customFontOptions.value.length === 0) {
    return [...EDITOR_FONT_OPTIONS]
  }

  return [
    ...EDITOR_FONT_OPTIONS,
    { type: 'divider' },
    { type: 'subheader', title: 'Ваши шрифты' },
    ...customFontOptions.value,
  ]
})
