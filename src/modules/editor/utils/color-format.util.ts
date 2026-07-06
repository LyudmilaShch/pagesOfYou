export interface ParsedCssColor {
  r: number
  g: number
  b: number
  alpha: number
  hex: string
  alphaPercent: number
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function clampAlpha(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function channelToHex(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0').toUpperCase()
}

function expandShortHex(value: string): string {
  if (value.length !== 3) {
    return value
  }

  return value
    .split('')
    .map((char) => `${char}${char}`)
    .join('')
}

function parseHexColor(raw: string, fallback: ParsedCssColor): ParsedCssColor {
  let hex = raw.replace('#', '').trim().toUpperCase()

  if (hex.length === 8) {
    const alpha = clampAlpha(parseInt(hex.slice(6, 8), 16) / 255)
    hex = hex.slice(0, 6)
    const parsed = parseHexColor(hex, fallback)
    return {
      ...parsed,
      alpha,
      alphaPercent: Math.round(alpha * 100),
    }
  }

  if (hex.length === 3) {
    hex = expandShortHex(hex)
  }

  if (!/^[0-9A-F]{6}$/.test(hex)) {
    return fallback
  }

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  return {
    r,
    g,
    b,
    alpha: 1,
    hex,
    alphaPercent: 100,
  }
}

function parseRgbColor(raw: string, fallback: ParsedCssColor): ParsedCssColor {
  const match = raw.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i,
  )

  if (!match) {
    return fallback
  }

  const r = clampChannel(Number(match[1]))
  const g = clampChannel(Number(match[2]))
  const b = clampChannel(Number(match[3]))
  const alpha = match[4] === undefined ? 1 : clampAlpha(Number(match[4]))
  const hex = `${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`

  return {
    r,
    g,
    b,
    alpha,
    hex,
    alphaPercent: Math.round(alpha * 100),
  }
}

export function createFallbackColor(fallback = '#111111'): ParsedCssColor {
  return parseHexColor(fallback, {
    r: 17,
    g: 17,
    b: 17,
    alpha: 1,
    hex: '111111',
    alphaPercent: 100,
  })
}

export function parseCssColor(value: string | null | undefined, fallback = '#111111'): ParsedCssColor {
  const fallbackColor = createFallbackColor(fallback)
  const raw = value?.trim()

  if (!raw) {
    return fallbackColor
  }

  if (raw.startsWith('#')) {
    return parseHexColor(raw, fallbackColor)
  }

  if (raw.startsWith('rgb')) {
    return parseRgbColor(raw, fallbackColor)
  }

  if (/^[0-9A-F]{3,8}$/i.test(raw)) {
    return parseHexColor(`#${raw}`, fallbackColor)
  }

  return fallbackColor
}

export function formatCssColor(color: Pick<ParsedCssColor, 'r' | 'g' | 'b' | 'alpha'>): string {
  const alpha = clampAlpha(color.alpha)

  if (alpha >= 1) {
    return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`
  }

  const roundedAlpha = Math.round(alpha * 1000) / 1000
  return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${roundedAlpha})`
}

export function toNativeColorInputValue(color: ParsedCssColor): string {
  return `#${color.hex}`
}

export function normalizeHexInput(value: string): string {
  return value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()
}

export function clampAlphaPercent(value: number, fallback = 100): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}
