/**
 * Generic, UI-agnostic description of a single parametrized visual treatment (a shadow variant,
 * a visual-effect variant, or any future one-active-slot "pick a type, tweak its params" feature).
 *
 * The properties panel (screens under `properties-panel/screens`) never hard-codes per-type UI —
 * it renders `fields` generically and calls `getKonvaAttrs`/`getExtraNodes` to know what to draw.
 * Adding a new effect/shadow variant means adding one descriptor to a registry array; nothing
 * else in the UI or rendering pipeline needs to change.
 */

export interface EffectFieldDef {
  key: string
  label: string
  kind: 'color' | 'number'
  min?: number
  max?: number
  step?: number
}

/** A sibling Konva node an effect needs beyond plain attributes on the shape itself. */
export interface EffectExtraNodeSpec {
  nodeType: 'rect' | 'circle' | 'line' | 'group'
  /** Konva config for this node (position/size/fill/opacity/filters/etc). */
  config: Record<string, unknown>
  /** 'behind' renders before the main shape (underneath); 'front' renders after (on top). */
  layer: 'behind' | 'front'
  /** Only for nodeType 'group' — nested extra nodes clipped/positioned within it. */
  children?: EffectExtraNodeSpec[]
}

export interface ShapeGeometry {
  type: 'shape-rectangle' | 'shape-circle' | 'shape-line'
  width: number
  height: number
  cornerRadius: number
}

export interface EffectDescriptor<TType extends string, TParams extends Record<string, number | string>> {
  type: TType
  label: string
  fields: EffectFieldDef[]
  defaultParams: TParams
  /** Attrs merged directly onto the shape's own Konva config (shadow*, stroke, fill*, filters). */
  getKonvaAttrs?: (params: TParams, geometry: ShapeGeometry) => Record<string, unknown>
  /** Extra sibling nodes this effect needs (offset copies, tint overlays, clipped insets, etc). */
  getExtraNodes?: (params: TParams, geometry: ShapeGeometry) => EffectExtraNodeSpec[]
}

export function findDescriptor<TType extends string, TParams extends Record<string, number | string>>(
  registry: Array<EffectDescriptor<TType, TParams>>,
  type: TType,
): EffectDescriptor<TType, TParams> {
  const def = registry.find((entry) => entry.type === type)
  if (!def) {
    throw new Error(`Unknown effect type: ${type}`)
  }
  return def
}
