import type { CanvasAiTextPlaceholder, CanvasLeafElement } from '../types/canvas-data.types';
import { groupAiTextLeaves } from './element-tree.util';

/** Cap on how much of the journal's other generated text goes into a journal-wide text's prompt
 * (cover lines etc.) — enough to know what the journal is about without blowing the model's
 * context on a journal with many long spreads. */
export const MAX_JOURNAL_CONTEXT_CHARS = 4000;

export interface PromptQuestion {
  key: string;
  label: string;
}

/**
 * The assembled instruction for a `contentSource: 'questions'` text: the admin prompt plus the
 * question/answer pairs of the text's own `questionKeys`. `null` when none of them has a
 * non-empty answer yet (nothing to generate from). Pure — the order flow feeds it from the DB, the
 * guest flow from the answers the browser holds.
 */
export function buildQuestionsPromptContext(
  lead: CanvasAiTextPlaceholder,
  questionByKey: Map<string, PromptQuestion>,
  answerByKey: Map<string, string>,
): string | null {
  const pairs = lead.questionKeys
    .map((key) => {
      const question = questionByKey.get(key);
      const answerText = answerByKey.get(key)?.trim();
      return question && answerText ? `${question.label}: ${answerText}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (pairs.length === 0) {
    return null;
  }

  return `${lead.prompt}\n\nОтветы пользователя:\n${pairs.join('\n')}`;
}

/** The journal's other AI texts, in journal order, capped at MAX_JOURNAL_CONTEXT_CHARS — never
 * the parts in `ownIds`, nor another journal-wide text (whose content would itself be derived
 * from this same summary). */
export function collectJournalTexts(
  pages: Array<{ leaves: CanvasLeafElement[]; textByElementId: Map<string, string> }>,
  ownIds: Set<string>,
): string[] {
  const texts: string[] = [];
  let length = 0;
  for (const page of pages) {
    for (const group of groupAiTextLeaves(page.leaves)) {
      if (group[0].contentSource === 'journal' || group.some((part) => ownIds.has(part.id))) {
        continue;
      }
      const text = group
        .map((part) => page.textByElementId.get(part.id)?.trim())
        .filter(Boolean)
        .join(' ');
      if (text && length + text.length <= MAX_JOURNAL_CONTEXT_CHARS) {
        texts.push(text);
        length += text.length;
      }
    }
  }
  return texts;
}

/**
 * Context for a `contentSource: 'journal'` text (cover lines etc.): the admin prompt, EVERY
 * answered question (`questions` in questionnaire order), the journal's other texts and — flagged
 * as the top priority — the answers to the text's own `questionKeys` (the customer's wishes,
 * asked as the questionnaire's last step). `null` when there's nothing at all to write from yet.
 */
export function buildJournalPromptContext(
  lead: CanvasAiTextPlaceholder,
  questions: PromptQuestion[],
  answerByKey: Map<string, string>,
  journalTexts: string[],
): string | null {
  const wishKeys = new Set(lead.questionKeys);
  const lineOf = (question: PromptQuestion) => `${question.label}: ${answerByKey.get(question.key)?.trim()}`;
  const answered = questions.filter((question) => answerByKey.get(question.key)?.trim());
  const answerLines = answered.filter((question) => !wishKeys.has(question.key)).map(lineOf);
  const wishLines = answered.filter((question) => wishKeys.has(question.key)).map(lineOf);

  if (answerLines.length === 0 && wishLines.length === 0 && journalTexts.length === 0) {
    return null;
  }

  return [
    lead.prompt,
    answerLines.length > 0 ? `Ответы пользователя в анкете:\n${answerLines.join('\n')}` : null,
    journalTexts.length > 0 ? `Тексты, которые уже есть в журнале:\n${journalTexts.join('\n\n')}` : null,
    wishLines.length > 0
      ? `Пожелания пользователя к этому тексту — учти их в первую очередь:\n${wishLines.join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}
