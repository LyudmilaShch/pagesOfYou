import type { ThemeDefinition } from 'vuetify'

/**
 * Design tokens — single source of truth for TypeScript usage.
 * SCSS tokens in variables.scss mirror these values.
 */
export const designTokens = {
  colors: {
    white: '#FFFFFF',
    black: '#0D0D0D',
    accent: '#E85A93',
    accentDeep: '#C13F73',
    accentTint: '#FBDFE9',
    bgPrimary: '#F9F9F9',
    bgSecondary: '#ECECEC',
    bgTertiary: '#F1F1F1',
    bgMuted: '#F3F3F3',
    bgElevated: '#FFFFFF',
    textPrimary: '#0D0D0D',
    textSecondary: '#6E6E6E',
    textMuted: '#8A8A8A',
    textDisabled: '#B0B0B0',
    border: '#DEDEDE',
    borderLight: '#E8E8E8',
    borderStrong: '#C9C9C9',
    divider: '#E5E5E5',
    onDark: {
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      surfaceSoft: 'rgba(255, 255, 255, 0.35)',
      surfaceMedium: 'rgba(255, 255, 255, 0.55)',
      textMuted: 'rgba(255, 255, 255, 0.62)',
      textSecondary: 'rgba(255, 255, 255, 0.78)',
      textBody: 'rgba(255, 255, 255, 0.9)',
      textPrimary: 'rgba(255, 255, 255, 0.95)',
      textEmphasis: 'rgba(255, 255, 255, 0.96)',
    },
  },
  typography: {
    fontDisplay: 'Unbounded, Playfair Display, Georgia, serif',
    fontBody: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    sizes: {
      displayXl: '72px',
      displayL: '64px',
      h1: '56px',
      h2: '44px',
      h3: '32px',
      h4: '24px',
      bodyLg: '18px',
      body: '16px',
      bodySm: '14px',
      caption: '12px',
    },
  },
  spacing: [4, 8, 12, 16, 24, 32, 48, 64, 80, 120] as const,
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    xl: '14px',
  },
  shadows: {
    xs: '0 1px 2px rgba(13, 13, 13, 0.04)',
    sm: '0 2px 4px rgba(13, 13, 13, 0.05)',
    md: '0 4px 12px rgba(13, 13, 13, 0.06)',
    lg: '0 8px 24px rgba(13, 13, 13, 0.07)',
  },
  breakpoints: {
    mobileMax: 767,
    tabletMin: 768,
    tabletMax: 1279,
    desktopMin: 1280,
    desktopMax: 1599,
    wideMin: 1600,
  },
} as const

export type DesignTokens = typeof designTokens

const { colors } = designTokens

export const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: colors.bgPrimary,
    surface: colors.bgElevated,
    'surface-bright': colors.white,
    'surface-light': colors.bgSecondary,
    'surface-variant': colors.bgTertiary,
    'on-surface-variant': colors.textSecondary,
    primary: colors.accent,
    'primary-darken-1': colors.accentDeep,
    'on-primary': colors.white,
    secondary: colors.textSecondary,
    'on-secondary': colors.white,
    error: '#8A4B45',
    info: '#4A6670',
    success: '#4A6B52',
    warning: '#7A6340',
    'on-background': colors.textPrimary,
    'on-surface': colors.textPrimary,
    'outline': colors.border,
    'outline-variant': colors.borderLight,
  },
  variables: {
    'border-color': colors.border,
    'border-opacity': 1,
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.6,
    'disabled-opacity': 0.38,
    'idle-opacity': 0.04,
    'hover-opacity': 0.04,
    'focus-opacity': 0.08,
    'selected-opacity': 0.08,
    'activated-opacity': 0.08,
    'pressed-opacity': 0.12,
    'dragged-opacity': 0.08,
  },
}

export const theme = {
  defaultTheme: 'light' as const,
  themes: {
    light: lightTheme,
  },
}

export type AppTheme = typeof theme
