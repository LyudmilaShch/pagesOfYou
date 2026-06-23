export type BadgeType = 'TOP' | 'NEW' | 'SALE' | 'POPULAR' | 'LIMITED'

export interface MagazineType {
  id: string
  name: string
  description: string
  /** URL изображения-обложки, соотношение 3:4 */
  image: string
  /** Актуальная (базовая) цена в рублях */
  basePrice: number | null
  /** Старая цена — если задана, отображается перечеркнутой */
  oldPrice: number | null
  /** Тип маркетингового бейджа */
  badgeType: BadgeType | null
  /** Произвольный текст бейджа (приоритет над стандартным) */
  badgeText: string | null
  /** Порядок отображения */
  sortOrder?: number
}
