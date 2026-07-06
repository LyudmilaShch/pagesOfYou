import type Konva from 'konva'

import {
  TRANSFORMER_ANCHOR_FILL,
  TRANSFORMER_ANCHOR_STROKE,
  TRANSFORMER_ANCHOR_STROKE_WIDTH,
  TRANSFORMER_BORDER_STROKE,
  TRANSFORMER_BORDER_STROKE_WIDTH,
  TRANSFORMER_CORNER_ANCHOR_SIZE,
  TRANSFORMER_PADDING,
  TRANSFORMER_ROTATE_ANCHOR_ANGLE,
  TRANSFORMER_ROTATE_ANCHOR_OFFSET,
  TRANSFORMER_ROTATE_ANCHOR_SIZE,
  TRANSFORMER_ROTATE_ANCHOR_FILL,
  TRANSFORMER_ROTATE_ANCHOR_FILL_HOVER,
  TRANSFORMER_ROTATE_ICON_COLOR,
  TRANSFORMER_ROTATE_ICON_COLOR_HOVER,
  TRANSFORMER_ROTATE_ANCHOR_BORDER,
  TRANSFORMER_SIDE_ANCHOR_HEIGHT,
  TRANSFORMER_SIDE_ANCHOR_WIDTH,
} from '../constants/page.constants'
import {
  buildRotateCursorStyle,
  getRotateCursorAngle,
  getRotateCursorAngleTowardTarget,
} from './rotate-cursor.util'

const ANCHOR_SHADOW = {
  shadowColor: 'rgba(0, 0, 0, 0.14)',
  shadowBlur: 4,
  shadowOffsetX: 0,
  shadowOffsetY: 1,
  shadowOpacity: 1,
}

function getTransformerAnchorKey(anchor: Konva.Rect): string {
  return anchor.name().split(' ')[0] ?? anchor.name()
}

function setCircularAnchor(anchor: Konva.Rect, size: number): void {
  anchor.setAttrs({
    width: size,
    height: size,
    offsetX: size / 2,
    offsetY: size / 2,
    cornerRadius: size / 2,
    fill: TRANSFORMER_ANCHOR_FILL,
    stroke: TRANSFORMER_ANCHOR_STROKE,
    strokeWidth: TRANSFORMER_ANCHOR_STROKE_WIDTH,
    ...ANCHOR_SHADOW,
  })
}

function drawArrowHead(
  context: Konva.Context,
  tipX: number,
  tipY: number,
  direction: number,
  size: number,
): void {
  context.beginPath()
  context.moveTo(tipX, tipY)
  context.lineTo(
    tipX - size * Math.cos(direction - 0.5),
    tipY - size * Math.sin(direction - 0.5),
  )
  context.moveTo(tipX, tipY)
  context.lineTo(
    tipX - size * Math.cos(direction + 0.5),
    tipY - size * Math.sin(direction + 0.5),
  )
  context.stroke()
}

function drawArcArrow(
  context: Konva.Context,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  anticlockwise: boolean,
  arrowSize: number,
): void {
  context.beginPath()
  context.arc(centerX, centerY, radius, startAngle, endAngle, anticlockwise)
  context.stroke()

  const tipX = centerX + radius * Math.cos(endAngle)
  const tipY = centerY + radius * Math.sin(endAngle)
  const direction = endAngle + (anticlockwise ? -Math.PI / 2 : Math.PI / 2)

  drawArrowHead(context, tipX, tipY, direction, arrowSize)
}

function drawRotateIcon(
  context: Konva.Context,
  width: number,
  height: number,
  iconColor = TRANSFORMER_ROTATE_ICON_COLOR,
): void {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.26
  const arrowSize = radius * 0.38

  context.strokeStyle = iconColor
  context.lineWidth = 1.2
  context.lineCap = 'round'
  context.lineJoin = 'round'

  drawArcArrow(context, centerX, centerY, radius, Math.PI * 0.58, Math.PI * 1.18, true, arrowSize)
}

function getTransformerNodeRotation(transformer: Konva.Transformer): number {
  return transformer.nodes()[0]?.rotation() ?? 0
}

function getRotateCursorAngleForAnchor(
  anchor: Konva.Rect,
  transformer: Konva.Transformer,
  preferPointer = false,
): number {
  const node = transformer.nodes()[0]
  const stage = anchor.getStage()

  if (!node || !stage) {
    return getRotateCursorAngle(getTransformerNodeRotation(transformer))
  }

  const nodeRect = node.getClientRect({ relativeTo: stage })
  const targetX = nodeRect.x + nodeRect.width / 2
  const targetY = nodeRect.y + nodeRect.height / 2

  if (preferPointer) {
    const pointer = stage.getPointerPosition()
    if (pointer) {
      return getRotateCursorAngleTowardTarget(pointer.x, pointer.y, targetX, targetY)
    }
  }

  const anchorPos = anchor.getAbsolutePosition()
  return getRotateCursorAngleTowardTarget(anchorPos.x, anchorPos.y, targetX, targetY)
}

function setRotateCursor(anchor: Konva.Rect, preferPointer = false): void {
  const stage = anchor.getStage()
  const transformer = anchor.getParent() as Konva.Transformer | null

  if (!stage?.content || !transformer) {
    return
  }

  stage.content.style.cursor = buildRotateCursorStyle(
    getRotateCursorAngleForAnchor(anchor, transformer, preferPointer),
  )
}

function clearRotateCursor(anchor: Konva.Rect): void {
  const stage = anchor.getStage()

  if (stage?.content) {
    stage.content.style.cursor = ''
  }
}

function setRotateHandleHovered(anchor: Konva.Rect, hovered: boolean): void {
  anchor.setAttr('rotateHandleHovered', hovered)
  anchor.getLayer()?.batchDraw()
}

function attachRotateCursorHandlers(anchor: Konva.Rect): void {
  let isRotating = false

  anchor.off('.rotateCursor')
  anchor.setAttr('rotateHandleHovered', false)

  anchor.on('mouseenter.rotateCursor', () => {
    setRotateHandleHovered(anchor, true)
    setRotateCursor(anchor)
  })

  anchor.on('mouseleave.rotateCursor', () => {
    if (!isRotating) {
      setRotateHandleHovered(anchor, false)
      clearRotateCursor(anchor)
    }
  })

  anchor.on('mousedown.rotateCursor touchstart.rotateCursor', () => {
    const transformer = anchor.getParent() as Konva.Transformer | null

    if (!transformer) {
      return
    }

    isRotating = true
    setRotateHandleHovered(anchor, true)
    setRotateCursor(anchor)

    const onTransform = (): void => {
      setRotateCursor(anchor, true)
    }

    const onPointerUp = (): void => {
      isRotating = false
      transformer.off('transform.rotateCursorDrag')
      window.removeEventListener('mouseup', onPointerUp, true)
      window.removeEventListener('touchend', onPointerUp, true)
      setRotateHandleHovered(anchor, false)
      clearRotateCursor(anchor)
    }

    transformer.on('transform.rotateCursorDrag', onTransform)
    window.addEventListener('mouseup', onPointerUp, true)
    window.addEventListener('touchend', onPointerUp, true)
  })
}

export function normalizeElementRotation(
  value: string | number | null | undefined,
  fallback = 0,
): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  let angle = parsed % 360
  if (angle > 180) {
    angle -= 360
  }
  if (angle <= -180) {
    angle += 360
  }

  return Math.round(angle * 10) / 10
}

export function applyTransformerAnchorStyle(anchor: Konva.Rect): void {
  const name = getTransformerAnchorKey(anchor)

  if (name === 'rotater') {
    const size = TRANSFORMER_ROTATE_ANCHOR_SIZE
    anchor.setAttrs({
      width: size,
      height: size,
      offsetX: size / 2,
      offsetY: size / 2,
      cornerRadius: size / 2,
      fill: TRANSFORMER_ROTATE_ANCHOR_FILL,
      stroke: TRANSFORMER_ROTATE_ANCHOR_BORDER,
      strokeWidth: 1,
      shadowColor: 'rgba(17, 17, 17, 0.2)',
      shadowBlur: 6,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowOpacity: 1,
    })
    anchor.sceneFunc((context, shape) => {
      const width = shape.width()
      const height = shape.height()
      const radius = width / 2 - 0.5
      const isHovered = shape.getAttr('rotateHandleHovered') === true
      const fillColor = isHovered
        ? TRANSFORMER_ROTATE_ANCHOR_FILL_HOVER
        : TRANSFORMER_ROTATE_ANCHOR_FILL
      const borderColor = isHovered
        ? TRANSFORMER_ROTATE_ANCHOR_FILL_HOVER
        : TRANSFORMER_ROTATE_ANCHOR_BORDER
      const iconColor = isHovered
        ? TRANSFORMER_ROTATE_ICON_COLOR_HOVER
        : TRANSFORMER_ROTATE_ICON_COLOR

      context.beginPath()
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2)
      context.fillStyle = fillColor
      context.fill()
      context.strokeStyle = borderColor
      context.lineWidth = 1
      context.stroke()

      drawRotateIcon(context, width, height, iconColor)
    })
    anchor.hitFunc((context, shape) => {
      const width = shape.width()
      const height = shape.height()
      context.beginPath()
      context.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2)
      context.fillStrokeShape(shape)
    })
    attachRotateCursorHandlers(anchor)
    return
  }

  if (
    name === 'middle-left' ||
    name === 'middle-right' ||
    name === 'top-center' ||
    name === 'bottom-center'
  ) {
    const isVertical = name === 'middle-left' || name === 'middle-right'
    const width = isVertical ? TRANSFORMER_SIDE_ANCHOR_WIDTH : TRANSFORMER_SIDE_ANCHOR_HEIGHT
    const height = isVertical ? TRANSFORMER_SIDE_ANCHOR_HEIGHT : TRANSFORMER_SIDE_ANCHOR_WIDTH
    anchor.setAttrs({
      width,
      height,
      offsetX: width / 2,
      offsetY: height / 2,
      cornerRadius: Math.min(width, height) / 2,
      fill: TRANSFORMER_ANCHOR_FILL,
      stroke: TRANSFORMER_ANCHOR_STROKE,
      strokeWidth: TRANSFORMER_ANCHOR_STROKE_WIDTH,
      ...ANCHOR_SHADOW,
    })
    return
  }

  setCircularAnchor(anchor, TRANSFORMER_CORNER_ANCHOR_SIZE)
}

export function getTransformerEnabledAnchors(options: {
  isText?: boolean
  isLine?: boolean
  isMultiSelection?: boolean
}): string[] {
  if (options.isMultiSelection) {
    return []
  }

  if (options.isText) {
    return ['middle-left', 'middle-right']
  }

  if (options.isLine) {
    return ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  }

  return [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]
}

export function buildTransformerChromeConfig(
  options: {
    rotateEnabled?: boolean
    enabledAnchors?: string[]
    boundBoxFunc?: Konva.TransformerConfig['boundBoxFunc']
  } = {},
): Konva.TransformerConfig {
  return {
    rotateEnabled: options.rotateEnabled ?? true,
    borderEnabled: true,
    borderStroke: TRANSFORMER_BORDER_STROKE,
    borderStrokeWidth: TRANSFORMER_BORDER_STROKE_WIDTH,
    anchorFill: TRANSFORMER_ANCHOR_FILL,
    anchorStroke: TRANSFORMER_ANCHOR_STROKE,
    anchorStrokeWidth: TRANSFORMER_ANCHOR_STROKE_WIDTH,
    anchorSize: TRANSFORMER_CORNER_ANCHOR_SIZE,
    anchorCornerRadius: TRANSFORMER_CORNER_ANCHOR_SIZE / 2,
    padding: TRANSFORMER_PADDING,
    keepRatio: false,
    rotateLineVisible: false,
    rotateAnchorAngle: TRANSFORMER_ROTATE_ANCHOR_ANGLE,
    rotateAnchorOffset: TRANSFORMER_ROTATE_ANCHOR_OFFSET,
    rotateAnchorCursor: buildRotateCursorStyle(TRANSFORMER_ROTATE_ANCHOR_ANGLE),
    anchorStyleFunc: applyTransformerAnchorStyle,
    enabledAnchors: options.enabledAnchors,
    boundBoxFunc: options.boundBoxFunc,
  }
}
