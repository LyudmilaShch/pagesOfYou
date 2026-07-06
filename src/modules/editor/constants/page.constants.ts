/** A4 portrait dimensions in logical editor units (72 DPI points). */

export const A4_PAGE_WIDTH = 595

export const A4_PAGE_HEIGHT = 842

/** Two A4 portrait pages side by side — standard magazine spread. */
export const A4_SPREAD_PAGE_WIDTH = A4_PAGE_WIDTH * 2

export const A4_SPREAD_PAGE_HEIGHT = A4_PAGE_HEIGHT

export const A4_SPREAD_FOLD_X = A4_PAGE_WIDTH

/** Visual gap between left and right sheets in spread editor preview (pt). */
export const A4_SPREAD_PAGE_GAP = 0

/** Dashed guide at the spread fold (between left and right sheets). */
export const SPREAD_FOLD_LINE_STROKE = 'rgba(17, 17, 17, 0.35)'

export const SPREAD_FOLD_LINE_DASH = [8, 6] as const



export const EDITOR_FONT_DISPLAY = 'Playfair Display'

export const EDITOR_FONT_BODY = 'Inter'



export const EDITOR_FONT_OPTIONS = [

  { title: 'Playfair Display', value: 'Playfair Display' },

  { title: 'Inter', value: 'Inter' },

  { title: 'Georgia', value: 'Georgia' },

  { title: 'Times New Roman', value: 'Times New Roman' },

  { title: 'Arial', value: 'Arial' },

  { title: 'Helvetica', value: 'Helvetica' },

] as const



export const PAGE_SIZE_PRESETS = [

  { label: 'A4 портрет', width: 595, height: 842 },

  { label: 'A4 альбом', width: 842, height: 595 },

  { label: 'Разворот 2×A4', width: A4_SPREAD_PAGE_WIDTH, height: A4_SPREAD_PAGE_HEIGHT },

  { label: 'Квадрат', width: 600, height: 600 },

  { label: 'Instagram', width: 540, height: 675 },

] as const



export const DEFAULT_SHAPE_FILL = '#E3DDD5'

export const DEFAULT_SHAPE_STROKE = '#111111'

export const DEFAULT_SHAPE_STROKE_WIDTH = 1

export const PHOTO_BORDER_STROKE_WIDTH_MIN = 0

export const PHOTO_BORDER_STROKE_WIDTH_MAX = 48

export const SHAPE_STROKE_WIDTH_MIN = 0

export const SHAPE_STROKE_WIDTH_MAX = 48



export const PHOTO_PLACEHOLDER_FILL = '#F3F1ED'

export const PHOTO_PLACEHOLDER_STROKE = '#D7D0C7'

/** Opacity of photo area outside the placeholder frame in reposition (dim) mode. */
export const PHOTO_PLACEHOLDER_DIM_OUTSIDE_OPACITY = 0.38

export const PHOTO_DOUBLE_CLICK_MS = 400

export const PHOTO_REPOSITION_WHEEL_ZOOM_STEP = 0.08

/** Konva Transformer chrome — Canva-like purple selection frame. */
export const TRANSFORMER_BORDER_STROKE = '#8B3DFF'

export const TRANSFORMER_ANCHOR_STROKE = '#8B3DFF'

export const TRANSFORMER_ANCHOR_FILL = '#FFFFFF'

export const TRANSFORMER_CORNER_ANCHOR_SIZE = 11

export const TRANSFORMER_SIDE_ANCHOR_WIDTH = 7

export const TRANSFORMER_SIDE_ANCHOR_HEIGHT = 20

export const TRANSFORMER_ROTATE_ANCHOR_SIZE = 24

export const TRANSFORMER_ROTATE_ANCHOR_OFFSET = 28

/** Degrees: 180 places the rotate handle below the object (Konva: 0=top, 90=right, 180=bottom). */
export const TRANSFORMER_ROTATE_ANCHOR_ANGLE = 180

/** Opaque white background for the rotate handle. */
export const TRANSFORMER_ROTATE_ANCHOR_FILL = '#FFFFFF'

/** Rotate handle fill on hover — matches selection purple. */
export const TRANSFORMER_ROTATE_ANCHOR_FILL_HOVER = TRANSFORMER_BORDER_STROKE

export const TRANSFORMER_ROTATE_ICON_COLOR = '#111111'

export const TRANSFORMER_ROTATE_ICON_COLOR_HOVER = '#FFFFFF'

/** Subtle ring around the rotate handle (visible on white pages). */
export const TRANSFORMER_ROTATE_ANCHOR_BORDER = 'rgba(0, 0, 0, 0.14)'

export const TRANSFORMER_BORDER_STROKE_WIDTH = 1.5

export const TRANSFORMER_ANCHOR_STROKE_WIDTH = 1

export const TRANSFORMER_PADDING = 0



export const DEFAULT_PAGE_BACKGROUND = '#FFFFFF'

export const DEFAULT_SNAP_GRID_SIZE = 10

export const SNAP_GRID_SIZE_OPTIONS = [5, 10, 20] as const

/** ~3 mm from page edge at 72 DPI — area that may be trimmed. */
export const PRINT_CROP_MARGIN = 8

/** ~8.5 mm inset at 72 DPI — recommended safe zone for important content. */
export const PRINT_SAFE_MARGIN = 18

export const PRINT_CROP_FILL = 'rgba(244, 67, 54, 0.18)'

export const PRINT_CROP_FILL_ACTIVE = 'rgba(244, 67, 54, 0.38)'

export const PRINT_SAFE_ZONE_STROKE = '#F44336'
