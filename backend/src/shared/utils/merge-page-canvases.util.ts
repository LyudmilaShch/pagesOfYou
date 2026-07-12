import {
  A4_PAGE_WIDTH,
  A4_SPREAD_PAGE_HEIGHT,
  A4_SPREAD_PAGE_WIDTH,
  type CanvasData,
  type CanvasElement,
} from '../types/canvas-data.types';

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

  return {
    version: 1,
    pageWidth: A4_SPREAD_PAGE_WIDTH,
    pageHeight: A4_SPREAD_PAGE_HEIGHT,
    backgroundColor: leftCanvas.backgroundColor ?? rightCanvas.backgroundColor ?? '#FFFFFF',
    backgroundImageUrl: leftCanvas.backgroundImageUrl ?? rightCanvas.backgroundImageUrl ?? null,
    backgroundImageFit: leftCanvas.backgroundImageFit ?? rightCanvas.backgroundImageFit ?? 'cover',
    backgroundImageCropX: leftCanvas.backgroundImageCropX ?? rightCanvas.backgroundImageCropX ?? 0,
    backgroundImageCropY: leftCanvas.backgroundImageCropY ?? rightCanvas.backgroundImageCropY ?? 0,
    backgroundImageScale: leftCanvas.backgroundImageScale ?? rightCanvas.backgroundImageScale ?? 1,
    elements: [...leftElements, ...rightElements],
  };
}
