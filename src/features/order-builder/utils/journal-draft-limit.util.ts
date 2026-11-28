import { ordersApi } from '../api/orders.api'
import type { OrderSummary } from '../types/order.types'
import { settingsApi } from '@/shared/api/settings.api'
import { extractApiErrorMessage } from '@/shared/utils/api-error.util'

/** Same string the backend returns from `POST /orders` when the account is already full. */
export const JOURNAL_DRAFT_LIMIT_CODE = 'JOURNAL_DRAFT_LIMIT'

/** Schema defaults — used when the public settings request fails. */
export const DEFAULT_MAX_JOURNAL_DRAFTS_GUEST = 2
export const DEFAULT_MAX_JOURNAL_DRAFTS_USER = 5

export interface JournalDraftLimits {
  guest: number
  user: number
}

export function isJournalDraftLimitError(err: unknown): boolean {
  if (err instanceof Error && err.message === JOURNAL_DRAFT_LIMIT_CODE) {
    return true
  }
  return extractApiErrorMessage(err, '') === JOURNAL_DRAFT_LIMIT_CODE
}

function wholeLimit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

export async function readJournalDraftLimits(): Promise<JournalDraftLimits> {
  try {
    const settings = await settingsApi.get()
    return {
      guest: wholeLimit(settings.maxJournalDraftsGuest, DEFAULT_MAX_JOURNAL_DRAFTS_GUEST),
      user: wholeLimit(settings.maxJournalDraftsUser, DEFAULT_MAX_JOURNAL_DRAFTS_USER),
    }
  } catch {
    return {
      guest: DEFAULT_MAX_JOURNAL_DRAFTS_GUEST,
      user: DEFAULT_MAX_JOURNAL_DRAFTS_USER,
    }
  }
}

/** DRAFT orders across every page of `GET /orders` — submitted orders do not take a slot. */
export async function listOpenDraftOrders(): Promise<OrderSummary[]> {
  let page = 1
  let seen = 0
  let total = 0
  const drafts: OrderSummary[] = []
  do {
    const result = await ordersApi.list(page, 50)
    total = result.total
    drafts.push(...result.items.filter((order) => order.status === 'DRAFT'))
    seen += result.items.length
    if (result.items.length === 0) {
      break
    }
    page += 1
  } while (seen < total)
  return drafts
}

export async function countOpenDraftOrders(): Promise<number> {
  const drafts = await listOpenDraftOrders()
  return drafts.length
}

function journalPhrase(limit: number): string {
  const mod10 = limit % 10
  const mod100 = limit % 100
  const one = mod10 === 1 && mod100 !== 11
  const few = mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
  if (one) return `${limit} журнал`
  if (few) return `${limit} журнала`
  return `${limit} журналов`
}

export function journalDraftLimitMessage(options: {
  mode: 'guest' | 'user'
  limit: number
  keptInBrowser?: boolean
}): string {
  const kept = options.keptInBrowser
    ? ' Часть начатых в браузере журналов перенесена в аккаунт, остальные остались в этом браузере.'
    : ''

  if (options.mode === 'guest') {
    if (options.limit <= 0) {
      return 'Без входа создать журнал нельзя. Войдите в аккаунт.'
    }
    return `Без аккаунта можно создать только ${journalPhrase(options.limit)}. Удалите черновик или войдите в аккаунт.`
  }

  if (options.limit <= 0) {
    return `Сейчас создать новый журнал нельзя.${kept}`
  }

  return `Можно создать только ${journalPhrase(options.limit)}. Удалите черновик, чтобы начать новый.${kept}`
}
