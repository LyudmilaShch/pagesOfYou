import {
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  CANVAS_DATA_VERSION,
  type CanvasData,
  type CanvasElement,
  type PageBackgroundSettings,
} from '../types/canvas-data.types';

function rootBackgroundOf(canvas: CanvasData): PageBackgroundSettings {
  return {
    backgroundColor: canvas.backgroundColor ?? '#FFFFFF',
    backgroundImageUrl: canvas.backgroundImageUrl ?? null,
    backgroundImageFit: canvas.backgroundImageFit ?? 'cover',
    backgroundImageCropX: canvas.backgroundImageCropX ?? 0,
    backgroundImageCropY: canvas.backgroundImageCropY ?? 0,
    backgroundImageScale: canvas.backgroundImageScale ?? 1,
  };
}

function cloneElementWithOffset(
  element: CanvasElement,
  idPrefix: string,
  xOffset: number,
): CanvasElement {
  return {
    ...element,
    id: `${idPrefix}${element.id}`,
    position: {
      ...element.position,
      x: element.position.x + xOffset,
    },
  };
}

/**
 * Combines two single-page canvases into one spread canvas (left + right).
 * Element ids are prefixed to avoid collisions when saving placeholder values.
 */
export function mergePageCanvasesIntoSpread(
  leftCanvas: CanvasData,
  rightCanvas: CanvasData,
): CanvasData {
  const leftElements = leftCanvas.elements.map((element) =>
    cloneElementWithOffset(element, 'left-', 0),
  );
  const rightElements = rightCanvas.elements.map((element) =>
    cloneElementWithOffset(element, 'right-', A4_PAGE_WIDTH),
  );

  // Each side keeps its OWN source page's background — flattening them into one shared value
  // (the old behavior: `leftCanvas.X ?? rightCanvas.X`) meant whichever page happened to have one
  // set "won" and then bled across BOTH halves once rendered, since nothing downstream knew to
  // treat it as per-page. The root fields below just mirror the left page's, as a harmless
  // fallback for any reader that doesn't know about per-page mode.
  const leftBackground = rootBackgroundOf(leftCanvas);
  const rightBackground = rootBackgroundOf(rightCanvas);

  return {
    version: CANVAS_DATA_VERSION,
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
    ...leftBackground,
    spreadBackgroundMode: 'per-page',
    leftPageBackground: leftBackground,
    rightPageBackground: rightBackground,
    elements: [...leftElements, ...rightElements],
  };
}
