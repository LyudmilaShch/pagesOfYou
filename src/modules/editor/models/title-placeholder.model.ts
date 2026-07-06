import type { TextPlaceholder } from './text-placeholder.model'

export interface TitlePlaceholder extends TextPlaceholder {
  type: 'title-placeholder'
}

export interface SubtitlePlaceholder extends TextPlaceholder {
  type: 'subtitle-placeholder'
}
