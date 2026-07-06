export const MIN_JOURNAL_SPREADS = 8

export type JournalSlotType = 'COVER' | 'SPREAD' | 'BACK_COVER'
export type JournalSpreadLayout = 'SPREAD' | 'SPLIT_PAGES'

export const JOURNAL_SLOT_LABELS: Record<JournalSlotType, string> = {
  COVER: 'Обложка',
  SPREAD: 'Разворот',
  BACK_COVER: 'Задняя обложка',
}
