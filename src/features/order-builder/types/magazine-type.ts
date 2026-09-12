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
  /** Сколько разворотов (= includedSpreads * 2 страниц) уже включено в basePrice */
  includedSpreads: number
  /** Цена за каждые дополнительные 4 страницы сверх includedSpreads — null/0, если доплаты нет */
  pricePerExtraFourPages: number | null
  /** Тип маркетингового бейджа */
  badgeType: BadgeType | null
  /** Произвольный текст бейджа (приоритет над стандартным) */
  badgeText: string | null
  /** Порядок отображения */
  sortOrder?: number
}
