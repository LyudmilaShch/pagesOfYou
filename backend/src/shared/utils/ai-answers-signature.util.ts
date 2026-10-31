/**
 * Fingerprint of the answers an AI text is written from — stored next to the text
 * (`PlaceholderValue.aiSourceHash`), so a generation can be skipped when the answers haven't
 * really changed and a text can be flagged as written from an earlier answer when they have.
 * Whitespace-only edits don't count as a change. The frontend has a byte-for-byte copy
 * (src/features/order-builder/utils/ai-answers-signature.util.ts) — it compares against hashes
 * this one wrote, so the two must never drift apart.
 */
export function aiAnswersSignature(
  questionKeys: string[],
  answerByKey: ReadonlyMap<string, string | null | undefined>,
): string {
  const source = [...questionKeys]
    .sort()
    .map((key) => `${key}\u0000${(answerByKey.get(key) ?? '').trim().replace(/\s+/g, ' ')}`)
    .join('\u0001');
  return fnv1a(source);
}

/** 32-bit FNV-1a over UTF-16 code units, as 8 hex digits — not cryptographic, only a change check. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
