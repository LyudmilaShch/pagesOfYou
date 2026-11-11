import { describe, expect, it } from 'vitest'

import type { PhotoFrameRef } from '../models/photo-placeholder.model'
import {
  PRINT_POINTS_PER_INCH,
  UPLOAD_MIN_LONG_SIDE_PX,
  UPLOAD_POOR_LONG_SIDE_PX,
  buildPhotoResolutionBadge,
  classifyPrintDpi,
  classifyUploadResolution,
  computePhotoEffectiveDpi,
} from './print-resolution.util'

/** 4×6 inch print. Page units are points, so inches * 72. */
const SLOT_4X6 = {
  width: 4 * PRINT_POINTS_PER_INCH,
  height: 6 * PRINT_POINTS_PER_INCH,
}

describe('computePhotoEffectiveDpi', () => {
  it('is source pixels on the side that fills the frame, divided by that side in inches', () => {
    // 1200×1800 on a 4×6 inch slot covers both sides exactly: 1200/4 = 300.
    const dpi = computePhotoEffectiveDpi({
      imageWidth: 1200,
      imageHeight: 1800,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
    })

    expect(dpi).toBeCloseTo(300, 5)
  })

  it('uses the side that cover actually prints, not the cropped side', () => {
    // Landscape photo in a portrait slot: height fills the 6 inch side (1200/6 = 200), width is cropped.
    const dpi = computePhotoEffectiveDpi({
      imageWidth: 1800,
      imageHeight: 1200,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
    })

    expect(dpi).toBeCloseTo(200, 5)
  })

  it('drops when the user zooms in, and ignores pan', () => {
    const base = computePhotoEffectiveDpi({
      imageWidth: 1200,
      imageHeight: 1800,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
      crop: { cropX: 0, cropY: 0, imageScale: 1 },
    })
    const zoomed = computePhotoEffectiveDpi({
      imageWidth: 1200,
      imageHeight: 1800,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
      crop: { cropX: 40, cropY: -15, imageScale: 2 },
    })

    expect(base).toBeCloseTo(300, 5)
    expect(zoomed).toBeCloseTo(150, 5)
  })

  it('treats contain like cover, matching the renderer', () => {
    const cover = computePhotoEffectiveDpi({
      imageWidth: 800,
      imageHeight: 600,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
      fitMode: 'cover',
    })
    const contain = computePhotoEffectiveDpi({
      imageWidth: 800,
      imageHeight: 600,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
      fitMode: 'contain',
    })

    expect(contain).toBeCloseTo(cover ?? 0, 5)
    // Height fills 6 inches: 600/6 = 100 DPI.
    expect(cover).toBeCloseTo(100, 5)
  })

  it('uses the worse axis when the photo is stretched to the frame', () => {
    const dpi = computePhotoEffectiveDpi({
      imageWidth: 1800,
      imageHeight: 600,
      printWidthPt: SLOT_4X6.width,
      printHeightPt: SLOT_4X6.height,
      fitMode: 'fill',
    })

    // Width 1800/4 = 450, height 600/6 = 100.
    expect(dpi).toBeCloseTo(100, 5)
  })

  it('returns null for unusable sizes', () => {
    expect(
      computePhotoEffectiveDpi({
        imageWidth: 0,
        imageHeight: 100,
        printWidthPt: 100,
        printHeightPt: 100,
      }),
    ).toBeNull()
    expect(
      computePhotoEffectiveDpi({
        imageWidth: 100,
        imageHeight: 100,
        printWidthPt: 0,
        printHeightPt: 100,
      }),
    ).toBeNull()
  })
})

describe('classifyPrintDpi', () => {
  it('warns below 150 and uses a softer band from 150 up to 200', () => {
    expect(classifyPrintDpi(149.9)).toBe('poor')
    expect(classifyPrintDpi(150)).toBe('soft')
    expect(classifyPrintDpi(199.9)).toBe('soft')
    expect(classifyPrintDpi(200)).toBe('ok')
    expect(classifyPrintDpi(300)).toBe('ok')
  })
})

describe('classifyUploadResolution', () => {
  it('flags a short long-side and stays quiet when dimensions are missing', () => {
    expect(classifyUploadResolution(UPLOAD_POOR_LONG_SIDE_PX - 1, 400)).toBe(
      'poor',
    )
    expect(classifyUploadResolution(UPLOAD_MIN_LONG_SIDE_PX - 1, 800)).toBe(
      'soft',
    )
    expect(classifyUploadResolution(UPLOAD_MIN_LONG_SIDE_PX, 800)).toBe('ok')
    expect(classifyUploadResolution(null, null)).toBe('ok')
    expect(classifyUploadResolution(100, 0)).toBe('ok')
  })
})

describe('buildPhotoResolutionBadge', () => {
  const page = { width: 595, height: 842 }
  const placement = {
    position: { x: 40, y: 40 },
    size: SLOT_4X6,
    fitMode: 'cover' as const,
    imageScale: 1,
  }

  it('stays hidden for a sharp placement and shows for a soft or poor one', () => {
    expect(
      buildPhotoResolutionBadge(placement, { width: 1200, height: 1800 }, page),
    ).toBeNull()

    const soft = buildPhotoResolutionBadge(
      placement,
      { width: 600, height: 900 },
      page,
    )
    // 600/4 = 150 DPI, the start of the soft band.
    expect(soft?.level).toBe('soft')
    expect(soft?.dpi).toBeCloseTo(150, 5)
    expect(soft?.message).toContain('чуть мягким')

    const poor = buildPhotoResolutionBadge(
      placement,
      { width: 400, height: 600 },
      page,
    )
    // 400/4 = 100 DPI.
    expect(poor?.level).toBe('poor')
    expect(poor?.dpi).toBeCloseTo(100, 5)
    expect(poor?.message).toBe(
      'Низкое разрешение: фото может получиться размытым при печати',
    )
  })

  it('measures the decorative frame window, which is smaller than the element box', () => {
    const frame: PhotoFrameRef = {
      imageUrl: 'frame.png',
      naturalWidth: 100,
      naturalHeight: 100,
      sliceTop: 10,
      sliceRight: 10,
      sliceBottom: 10,
      sliceLeft: 10,
      photoAreaTop: 25,
      photoAreaRight: 25,
      photoAreaBottom: 25,
      photoAreaLeft: 25,
    }

    // The window is half the element on each side, so the same 600×900 file prints at 300 DPI.
    const withFrame = buildPhotoResolutionBadge(
      { ...placement, frame },
      { width: 600, height: 900 },
      page,
    )
    const withoutFrame = buildPhotoResolutionBadge(
      placement,
      { width: 600, height: 900 },
      page,
    )

    expect(withFrame).toBeNull()
    expect(withoutFrame?.level).toBe('soft')
  })

  it('does not badge a photo that sits entirely off the page', () => {
    const offPage = buildPhotoResolutionBadge(
      { ...placement, position: { x: page.width + 20, y: 40 } },
      { width: 400, height: 600 },
      page,
    )

    expect(offPage).toBeNull()
  })

  it('keeps the badge inside the visible half of a spread', () => {
    const onLeft = buildPhotoResolutionBadge(
      placement,
      { width: 400, height: 600 },
      {
        ...page,
        visibleHalf: 'right',
      },
    )

    expect(onLeft).toBeNull()
  })
})
