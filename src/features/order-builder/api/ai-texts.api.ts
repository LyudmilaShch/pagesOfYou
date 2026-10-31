import { http } from '@/shared/api/http'
import type { BackendResponse } from '@/types/api.types'
import type { JournalSlotType, JournalSpreadLayout } from '../constants/journal.constants'

/** Today's AI allowance (see the backend's AiUsageService) — by account when signed in, by
 * guestId (+ IP) otherwise. A block's first text never draws on `remaining`. */
export interface AiUsageStatus {
  isGuest: boolean
  /** Regenerations (🔄, a signed-in customer's update after an answer change) — 0 for a guest. */
  limit: number
  used: number
  remaining: number
  /** The hidden cap on first texts is reached — new blocks stay unwritten until tomorrow. */
  fillCapReached: boolean
  guestAutoUpdatesPerText: number
}

/** 'fill' — a text's first version; 'update' — rewritten after an answer change; 'regenerate' — 🔄. */
export type DraftAiTextPurpose = 'fill' | 'update' | 'regenerate'

export interface GenerateDraftAiTextPayload {
  guestId?: string
  magazineTypeId: string
  /** The template(s) the page was built from — the server rebuilds the page (and so the admin's
   * prompt) from these; it never takes a prompt from the browser. */
  page: {
    slotType: JournalSlotType
    layoutMode: JournalSpreadLayout | null
    magazinePageId: string
    rightMagazinePageId: string | null
  }
  elementId: string
  /** 'all' — the whole text (every part of its chain); 'part' — rewrite only `elementId`. */
  scope: 'all' | 'part'
  purpose: DraftAiTextPurpose
  answers: Array<{ questionKey: string; textValue?: string }>
  currentTexts?: Array<{ elementId: string; text: string }>
  journalTexts?: string[]
}

export interface GenerateDraftAiTextResult {
  texts: Record<string, string>
  usage: AiUsageStatus
}

export const aiTextsApi = {
  async getUsage(guestId?: string): Promise<AiUsageStatus> {
    const { data } = await http.get<BackendResponse<AiUsageStatus>>('/ai-texts/usage', {
      params: guestId ? { guestId } : undefined,
    })
    return data.data
  },

  /** AI text for a journal that only exists in the browser (a guest's local draft). Rejects with
   * 429 at a daily limit, 403 for a guest's 'regenerate' — see `extractApiErrorMessage`. */
  async generateForDraft(payload: GenerateDraftAiTextPayload): Promise<GenerateDraftAiTextResult> {
    const { data } = await http.post<BackendResponse<GenerateDraftAiTextResult>>(
      '/ai-texts/draft/generate',
      payload,
    )
    return data.data
  },
}
