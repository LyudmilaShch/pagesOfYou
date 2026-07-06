import { normalizeCanvasData } from '@/modules/editor/models/canvas-data.model'

export function getTemplatePreviewAspectRatio(canvasData: unknown): string {
  const canvas = normalizeCanvasData(canvasData)
  const width = canvas.pageWidth ?? 595
  const height = canvas.pageHeight ?? 842
  return `${width} / ${height}`
}
