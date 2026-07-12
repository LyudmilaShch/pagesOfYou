import type { InjectionKey, Ref } from 'vue'

import type Konva from 'konva'

import type { PhotoBorderDrawNode } from '../../utils/element-stroke.util'
import type { NineSliceImageConfig } from '../../utils/photo-frame.util'

export interface EditorElementVisualsContext {
  backgroundRectConfig: Ref<Record<string, unknown> | null>
  photoRectConfig: Ref<Record<string, unknown> | null>
  photoUrl: Ref<string | null>
  photoIconLines: Ref<Record<string, unknown>[]>
  showPhotoEditorChrome: Ref<boolean>
  photoEmptyHintConfig: Ref<Record<string, unknown> | null>
  photoDropHighlightConfig: Ref<Record<string, unknown> | null>
  photoImageConfig: Ref<Record<string, unknown> | null>
  loadedImage: Ref<HTMLImageElement | null>
  isPhotoCropEditing: Ref<boolean>
  isPhotoDimmed: Ref<boolean>
  photoRepositionOutsideConfig: Ref<Record<string, unknown> | null>
  photoClipConfig: Ref<Record<string, unknown> | null>
  photoRepositionInsideConfig: Ref<Record<string, unknown> | null>
  photoDimBorderConfig: Ref<Record<string, unknown> | null>
  photoBorderDrawNodes: Ref<PhotoBorderDrawNode[]>
  frameSliceConfigs: Ref<NineSliceImageConfig[]>
  loadedFrameImage: Ref<HTMLImageElement | null>
  shapeRectConfig: Ref<Record<string, unknown> | null>
  shapeCircleConfig: Ref<Record<string, unknown> | null>
  shapeLineConfig: Ref<Record<string, unknown> | null>
  textConfig: Ref<Konva.TextConfig | null>
  isEditingText: Ref<boolean>
}

export const EDITOR_ELEMENT_VISUALS_KEY: InjectionKey<EditorElementVisualsContext> =
  Symbol('editorElementVisuals')
