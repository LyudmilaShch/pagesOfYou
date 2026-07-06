let checkerPattern: HTMLCanvasElement | null = null

export function getPhotoPlaceholderCheckerPattern(): HTMLCanvasElement {
  if (checkerPattern) {
    return checkerPattern
  }

  const tile = 10
  const canvas = document.createElement('canvas')
  canvas.width = tile * 2
  canvas.height = tile * 2

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return canvas
  }

  ctx.fillStyle = '#F3F1ED'
  ctx.fillRect(0, 0, tile * 2, tile * 2)
  ctx.fillStyle = '#E8E4DE'
  ctx.fillRect(0, 0, tile, tile)
  ctx.fillRect(tile, tile, tile, tile)

  checkerPattern = canvas
  return canvas
}
