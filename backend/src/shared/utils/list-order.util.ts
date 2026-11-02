import { isCanvasGroupElement, type CanvasElement, type CanvasListSettings } from '../types/canvas-data.types';

/** One item of a LIST answer: a title (the row's 'item' text) and an optional description (its
 * 'detail' text). Stored as a plain string when there's no description — which is also how every
 * answer saved before descriptions existed looks. */
export interface ListAnswerEntry {
  title: string;
  text: string;
}

export function toListEntries(items: unknown): ListAnswerEntry[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    if (typeof item === 'string') {
      return { title: item, text: '' };
    }
    const entry = (item ?? {}) as { title?: unknown; text?: unknown };
    return {
      title: typeof entry.title === 'string' ? entry.title : '',
      text: typeof entry.text === 'string' ? entry.text : '',
    };
  });
}

/** The stored shape: blank entries dropped, a string where there's no description. */
export function compactListEntries(entries: ListAnswerEntry[]): Array<string | ListAnswerEntry> {
  return entries
    .map((entry) => ({ title: entry.title.trim(), text: entry.text.trim() }))
    .filter((entry) => entry.title || entry.text)
    .map((entry) => (entry.text ? entry : entry.title));
}

/** One line per entry — "title — description" — for AI prompts and "is it answered" checks. */
export function listEntriesText(entries: ListAnswerEntry[]): string {
  return entries
    .map((entry) => [entry.title.trim(), entry.text.trim()].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('\n');
}

/** The settings of the (first) list bound to `questionKey` — rows mirror them, so any row will do;
 * a legacy list keeps them on its group. */
export function findListSettings(elements: CanvasElement[], questionKey: string): CanvasListSettings | null {
  for (const node of elements) {
    const settings = node.list ?? (isCanvasGroupElement(node) ? (node as { list?: CanvasListSettings }).list : null);
    if (settings?.questionKey === questionKey) {
      return settings;
    }
    if (isCanvasGroupElement(node)) {
      const nested = findListSettings(node.children, questionKey);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

type ListAnswerField = 'title' | 'text';

interface RowTexts {
  order: number;
  texts: Array<{ id: string; role: 'item' | 'detail'; questionKey: string | null }>;
}

/** Every list's rows on a page, in reading order (lists in the order their first row appears).
 * Rows anywhere in the tree share a `listId` and read in `listOrder` (frontend's list.model.ts); a
 * legacy list — a group with `list` and no `listId`, its children being the rows — reads in child
 * order. */
function collectListRows(elements: CanvasElement[]): RowTexts[][] {
  const rowsByList = new Map<string, RowTexts[]>();

  const textsOf = (node: CanvasElement): RowTexts['texts'] => {
    if (isCanvasGroupElement(node)) {
      return node.children.flatMap(textsOf);
    }
    const role = 'listRole' in node ? node.listRole : null;
    return role === 'item' || role === 'detail'
      ? [{ id: node.id, role, questionKey: 'questionKey' in node ? (node.questionKey ?? null) : null }]
      : [];
  };

  const addRow = (listId: string, order: number, row: CanvasElement): void => {
    const rows = rowsByList.get(listId) ?? [];
    rows.push({ order, texts: textsOf(row) });
    rowsByList.set(listId, rows);
  };

  const walk = (nodes: CanvasElement[]): void => {
    for (const node of nodes) {
      if (node.listId) {
        addRow(node.listId, node.listOrder ?? 0, node);
        continue;
      }
      if (!isCanvasGroupElement(node)) {
        continue;
      }
      if ((node as { list?: unknown }).list) {
        node.children.forEach((row, index) => addRow(node.id, index, row));
        continue;
      }
      walk(node.children);
    }
  };

  walk(elements);
  return [...rowsByList.values()].map((rows) => [...rows].sort((a, b) => a.order - b.order));
}

/**
 * Which entry and field of a LIST answer each text bound to `questionKey` on a page shows: rows of
 * that question's list(s) take entries one each, in reading order — the 'item' text the title, the
 * 'detail' text the description. `rowCount` is how many entries the page uses (the next page
 * continues from there).
 */
export function listAnswerSlots(
  elements: CanvasElement[],
  questionKey: string,
): { slots: Map<string, { entry: number; field: ListAnswerField }>; rowCount: number } {
  const slots = new Map<string, { entry: number; field: ListAnswerField }>();
  let rowCount = 0;
  for (const rows of collectListRows(elements)) {
    for (const row of rows) {
      const bound = row.texts.filter((text) => text.questionKey === questionKey);
      if (bound.length === 0) {
        continue;
      }
      for (const text of bound) {
        slots.set(text.id, { entry: rowCount, field: text.role === 'detail' ? 'text' : 'title' });
      }
      rowCount += 1;
    }
  }
  return { slots, rowCount };
}
