import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { CanvasAiTextChainMode, CanvasLengthConstraint } from '../../shared/types/canvas-data.types';

const SYSTEM_PROMPT =
  'Ты — редактор текста для персонального печатного журнала. Пиши тёплым, живым языком от ' +
  'первого лица там, где это уместно, используя только факты из ответов пользователя — ничего ' +
  'не выдумывай. В ответе верни ТОЛЬКО сам текст, без преамбул, пояснений, кавычек или заголовков.';

/** `chainMode: 'phrases'` (cover lines) — a different persona than SYSTEM_PROMPT's: that one
 * writes warm prose, which is exactly what makes cover lines come out flat and generic. */
const PHRASES_SYSTEM_PROMPT =
  'Ты — редактор обложек глянцевого журнала. Пишешь короткие анонсы, из-за которых хочется ' +
  'открыть журнал: конкретные, неожиданные, с характером. Опираешься только на факты из ответов ' +
  'пользователя и текстов журнала — ничего не выдумываешь. В ответе только сами анонсы в ' +
  'заданном формате, без пояснений.';

/** The craft part of a cover-line prompt, shared by whole-set generation and single-phrase
 * rewrites. The examples are about made-up people on purpose — they show the FORM of each
 * technique, and are explicitly not to be reused. */
const PHRASE_RULES =
  'Приёмы настоящих журнальных анонсов — используй разные, каждый не больше одного раза:\n' +
  '— конкретная деталь вместо оценки: «Борщ по бабушкиному рецепту, который никто не повторил»;\n' +
  '— число из жизни: «12 стран и ни одного забытого паспорта»;\n' +
  '— интрига или вопрос: «Зачем она хранит билет на поезд 2009 года?»;\n' +
  '— цитата человека или его любимая фраза — в кавычках-ёлочках;\n' +
  '— контраст: «Днём бухгалтер, по субботам — барабанщик».\n' +
  'Это примеры формы — не повторяй их слова и факты.\n\n' +
  'Правила:\n' +
  '— каждый анонс держится на конкретном факте из ответов: имя, место, число, предмет, ' +
  'привычка, событие. Анонс, который подошёл бы любому человеку, — плохой;\n' +
  '— никаких штампов: «удивительный человек», «яркая личность», «душа компании», «настоящий ' +
  'друг», «всегда готов помочь», «большое сердце», «особенный», «незабываемый», «уникальный», ' +
  '«в каждом из нас», «история любви»;\n' +
  '— анонсы не повторяют друг друга ни фактами, ни приёмами, ни первыми словами;\n' +
  '— живой разговорный язык, без пафоса и восклицательных знаков;\n' +
  '— без точки в конце и без нумерации.';

const PHRASES_TEMPERATURE = 0.85;

const MAX_ATTEMPTS = 3;

interface YandexGptMessage {
  role: 'system' | 'user' | 'assistant';
  text: string;
}

interface YandexGptCompletionResponse {
  result: {
    alternatives: Array<{ message: { role: string; text: string }; status: string }>;
    usage?: { inputTextTokens: string; completionTokens: string; totalTokens: string };
    modelVersion?: string;
  };
}

function countLength(text: string, unit: CanvasLengthConstraint['unit']): number {
  const trimmed = text.trim();
  if (unit === 'words') {
    return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
  }
  return trimmed.length;
}

function isWithinBounds(length: number, constraint: CanvasLengthConstraint): boolean {
  if (constraint.min != null && length < constraint.min) {
    return false;
  }
  if (constraint.max != null && length > constraint.max) {
    return false;
  }
  return true;
}

function describeConstraint(constraint: CanvasLengthConstraint): string {
  const unitLabel = constraint.unit === 'words' ? 'слов' : 'символов';
  if (constraint.min != null && constraint.max != null) {
    return `от ${constraint.min} до ${constraint.max} ${unitLabel}`;
  }
  if (constraint.max != null) {
    return `не больше ${constraint.max} ${unitLabel}`;
  }
  if (constraint.min != null) {
    return `не меньше ${constraint.min} ${unitLabel}`;
  }
  return '';
}

function unitLabel(unit: CanvasLengthConstraint['unit']): string {
  return unit === 'words' ? 'слов' : 'символов';
}

// "[Часть 2]" on its own line — tolerant of the case/bracket/colon variations the model drifts into.
const PART_MARKER = /^[ \t]*\[?[ \t]*часть[ \t]*(\d+)[ \t]*\]?[ \t]*:?[ \t]*$/gim;

/** Splits a marked-up multi-part answer into its parts, in the order they appear — `null` unless
 * there are exactly `count` non-empty parts. */
function parseParts(text: string, count: number): string[] | null {
  const markers = [...text.matchAll(PART_MARKER)];
  if (markers.length !== count) {
    return null;
  }
  const parts = markers.map((marker, index) => {
    const start = marker.index! + marker[0].length;
    const end = index + 1 < markers.length ? markers[index + 1].index! : text.length;
    return text.slice(start, end).trim();
  });
  return parts.every(Boolean) ? parts : null;
}

/** Last-resort split of an answer that ignored the part markers: whole sentences are dealt out in
 * order, each part taking sentences until it reaches its share of the total length (`max`, else
 * `min`, else an equal share). Never splits mid-sentence; returns `null` when there aren't enough
 * sentences to give every part at least one. */
function splitBySentences(text: string, constraints: CanvasLengthConstraint[]): string[] | null {
  const clean = text.replace(PART_MARKER, '').replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  if (sentences.length < constraints.length) {
    return null;
  }

  const weights = constraints.map((constraint) => constraint.max ?? constraint.min ?? 1);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  const parts: string[] = [];
  let cursor = 0;
  let consumedLength = 0;
  let consumedWeight = 0;
  constraints.forEach((_, index) => {
    const isLast = index === constraints.length - 1;
    consumedWeight += weights[index];
    // Cumulative: where (in characters of the whole text) this part should end.
    const targetEnd = (clean.length * consumedWeight) / weightTotal;
    // Sentences held back so every later part still gets at least one.
    const reserved = constraints.length - index - 1;
    const taken: string[] = [];
    while (
      cursor < sentences.length - reserved &&
      (isLast || taken.length === 0 || consumedLength < targetEnd)
    ) {
      taken.push(sentences[cursor]);
      consumedLength += sentences[cursor].length + 1;
      cursor += 1;
    }
    parts.push(taken.join(' '));
  });
  return parts;
}

const CONTINUOUS_INSTRUCTION = (count: number): string =>
  `Текст будет напечатан ${count} частями в разных блоках одной страницы журнала. Это один ` +
  'связный текст: каждая следующая часть продолжает предыдущую, без повторов и без заголовков, ' +
  'каждая часть заканчивается законченным предложением.';

const PHRASES_INSTRUCTION = (count: number): string =>
  (count === 1
    ? 'Напиши один анонс для обложки персонального журнала об этом человеке — он будет напечатан ' +
      'отдельной строкой, как на обложке настоящего журнала.\n\n'
    : `Напиши ${count} анонсов для обложки персонального журнала об этом человеке — каждый будет ` +
      'напечатан отдельно, как на обложке настоящего журнала.\n\n') +
  PHRASE_RULES;

/** Tidies a cover-line-style phrase: drops list bullets/numbering the model sometimes adds
 * anyway, ASCII/English quotes wrapped around the whole phrase, and a single trailing period
 * (keeping ?, ! and …). Russian «ёлочки» around the whole phrase are kept — a quote IS one of the
 * cover-line techniques asked for; when the model wraps every phrase of a set in them out of
 * habit instead, `unwrapUniformQuotes` strips them across the set. */
function cleanPhrase(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:[-–—•*]|\d+[.)])\s*/, '')
    // Period both outside ("…".) and inside ("….") the quotes.
    .replace(/(?<![.…])\.$/, '')
    .replace(/^["“„](.*)["”]$/, '$1')
    .replace(/(?<![.…])\.$/, '')
    .trim();
}

const GUILLEMET_WRAPPED = /^«(.*)»$/;

/** Every phrase wrapped in «» is the model's habit, not a deliberate quote — unwrap them all.
 * A set where only some are wrapped is left alone (those are the intended quote lines). */
function unwrapUniformQuotes(phrases: string[]): string[] {
  if (phrases.length < 2 || !phrases.every((phrase) => GUILLEMET_WRAPPED.test(phrase))) {
    return phrases;
  }
  return phrases.map((phrase) => phrase.replace(GUILLEMET_WRAPPED, '$1').trim());
}

/** Phrase-mode fallback when the part markers were ignored: one phrase per non-empty line —
 * `null` unless there are at least `count` of them. */
function splitByLines(text: string, count: number): string[] | null {
  const lines = text
    .replace(PART_MARKER, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length >= count ? lines.slice(0, count) : null;
}

/** Generates AI-text-placeholder content via YandexGPT (Yandex Cloud AI Studio) — chosen over
 * Anthropic/OpenAI because the site must run inside Russia. Best-effort by design: every public
 * method returns `null` instead of throwing on missing config or upstream failure, so a caller
 * (OrdersService) can treat AI generation as an optional side effect that never blocks saving a
 * questionnaire answer. */
@Injectable()
export class AiTextGenerationService {
  private readonly logger = new Logger(AiTextGenerationService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey() && this.folderId());
  }

  /** `promptContext` is the fully-assembled instruction (admin's prompt + question/answer pairs)
   * — this method only adds the system framing, the length-constraint line, and the retry loop.
   * `mode: 'phrases'` (a single cover line, e.g. a rewrite of one phrase) switches to the
   * cover-editor persona and the phrases model/temperature; the caller still runs `finalizePhrase`. */
  async generateText(
    promptContext: string,
    lengthConstraint: CanvasLengthConstraint,
    mode: CanvasAiTextChainMode = 'continuous',
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      this.logger.warn('YandexGPT is not configured (YANDEX_GPT_API_KEY/YANDEX_GPT_FOLDER_ID) — skipping AI text generation.');
      return null;
    }

    const constraintLine = describeConstraint(lengthConstraint);
    const messages: YandexGptMessage[] = [
      { role: 'system', text: mode === 'phrases' ? PHRASES_SYSTEM_PROMPT : SYSTEM_PROMPT },
      {
        role: 'user',
        text: constraintLine ? `${promptContext}\n\nОграничение длины: ${constraintLine}.` : promptContext,
      },
    ];

    let lastText: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let text: string;
      try {
        text = await this.complete(messages, mode);
      } catch (err) {
        this.logger.warn(`YandexGPT request failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${err}`);
        return lastText;
      }

      lastText = text;
      const length = countLength(text, lengthConstraint.unit);

      if (isWithinBounds(length, lengthConstraint) || attempt === MAX_ATTEMPTS) {
        return text;
      }

      messages.push({ role: 'assistant', text });
      messages.push({
        role: 'user',
        text: `Сейчас получилось ${length} ${lengthConstraint.unit === 'words' ? 'слов' : 'символов'}, а нужно ${constraintLine}. Перепиши текст, сохранив стиль и факты, уложись в ограничение.`,
      });
    }

    return lastText;
  }

  /**
   * One text split into `constraints.length` parts (an ai-text chain — see `groupAiTextLeaves`),
   * generated in a single request so the parts read as one continuous text. Same retry loop as
   * `generateText`, but every part is checked against its own constraint and the feedback names
   * only the parts that missed. If the model never manages the part markup, the last answer is
   * split by sentences instead of giving up. `null` on missing config/upstream failure, like
   * `generateText`.
   */
  async generateTextParts(
    promptContext: string,
    constraints: CanvasLengthConstraint[],
    /** Per-part "what this part is about" notes (same order as `constraints`), '' for none. */
    hints: string[] = [],
    mode: CanvasAiTextChainMode = 'continuous',
  ): Promise<string[] | null> {
    // A lone phrase still goes through the marked-up path below — it needs the cover-line
    // instruction and cleanup just as much as a whole set does.
    if (constraints.length === 1 && mode === 'continuous') {
      const text = await this.generateText(promptContext, constraints[0]);
      return text ? [text] : null;
    }

    if (!this.isConfigured()) {
      this.logger.warn('YandexGPT is not configured (YANDEX_GPT_API_KEY/YANDEX_GPT_FOLDER_ID) — skipping AI text generation.');
      return null;
    }

    const count = constraints.length;
    const partLines = constraints.map((constraint, index) => {
      const line = describeConstraint(constraint);
      const hint = hints[index]?.trim();
      return `Часть ${index + 1}: ${line || 'длина на твоё усмотрение'}${hint ? `; о чём она: ${hint}` : ''}`;
    });
    const markupExample = constraints.map((_, index) => `[Часть ${index + 1}]\nтекст части ${index + 1}`).join('\n');

    const messages: YandexGptMessage[] = [
      { role: 'system', text: mode === 'phrases' ? PHRASES_SYSTEM_PROMPT : SYSTEM_PROMPT },
      {
        role: 'user',
        text:
          `${promptContext}\n\n` +
          `${mode === 'phrases' ? PHRASES_INSTRUCTION(count) : CONTINUOUS_INSTRUCTION(count)}\n\n` +
          `Части:\n${partLines.join('\n')}\n\n` +
          'Перед каждой частью поставь отдельной строкой её метку — это единственное, что можно ' +
          `добавить к тексту. Формат ответа:\n${markupExample}`,
      },
    ];
    const finalize = (parts: string[]): string[] =>
      mode === 'phrases' ? unwrapUniformQuotes(parts.map(cleanPhrase)) : parts;

    let lastText: string | null = null;
    let lastParts: string[] | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let text: string;
      try {
        text = await this.complete(messages, mode);
      } catch (err) {
        this.logger.warn(`YandexGPT request failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${err}`);
        break;
      }

      lastText = text;
      const parts = parseParts(text, count);
      let feedback: string;

      if (!parts) {
        feedback =
          `Нужно ровно ${count} частей, каждая — после своей метки на отдельной строке ` +
          `([Часть 1] … [Часть ${count}]). Перепиши ответ в этом формате, сохранив текст.`;
      } else {
        lastParts = parts;
        const misses = parts
          .map((part, index) => {
            const constraint = constraints[index];
            const length = countLength(part, constraint.unit);
            return isWithinBounds(length, constraint)
              ? null
              : `часть ${index + 1} — сейчас ${length} ${unitLabel(constraint.unit)}, а нужно ${describeConstraint(constraint)}`;
          })
          .filter((miss): miss is string => Boolean(miss));

        if (misses.length === 0) {
          return finalize(parts);
        }
        feedback =
          `Не уложились в длину: ${misses.join('; ')}. Перепиши эти части, сохранив стиль и факты` +
          `${mode === 'phrases' ? '' : ' и связность'}, остальные оставь как есть. Верни все части в ` +
          'том же формате с метками.';
      }

      if (attempt < MAX_ATTEMPTS) {
        messages.push({ role: 'assistant', text });
        messages.push({ role: 'user', text: feedback });
      }
    }

    if (lastParts) {
      return finalize(lastParts);
    }
    if (!lastText) {
      return null;
    }
    const fallback =
      mode === 'phrases'
        ? (splitByLines(lastText, count) ?? splitBySentences(lastText, constraints))
        : splitBySentences(lastText, constraints);
    return fallback ? finalize(fallback) : null;
  }

  /** Context for rewriting ONE part of a chain (the customer's "regenerate" on that part) —
   * the shared prompt context, every part's current text with the target marked, and an
   * instruction matching the chain's mode. Pure prompt assembly; the caller runs `generateText`. */
  buildPartRewriteContext(
    promptContext: string,
    parts: Array<{ text: string; hint: string; isTarget: boolean }>,
    mode: CanvasAiTextChainMode,
  ): string {
    const targetNumber = parts.findIndex((part) => part.isTarget) + 1;
    const current = parts
      .map((part, index) => {
        const hint = part.hint.trim();
        const label = `[Часть ${index + 1}]${hint ? ` (о чём она: ${hint})` : ''}`;
        const body = part.isTarget ? '(эту часть нужно написать заново)' : part.text || '(пока не написана)';
        return `${label}\n${body}`;
      })
      .join('\n');

    const instruction =
      mode === 'phrases'
        ? `Напиши заново только анонс ${targetNumber} для обложки журнала. Возьми другой факт и ` +
          'другой приём, чем у остальных анонсов, и начни с других слов.\n\n' +
          `${PHRASE_RULES}\n\nВерни только этот анонс, без метки.`
        : `Напиши заново только часть ${targetNumber} так, чтобы она связно продолжала предыдущую ` +
          'часть и подводила к следующей, не повторяя их содержание. Верни только текст этой ' +
          'части, без метки.';

    if (parts.length === 1) {
      return mode === 'phrases'
        ? `${promptContext}\n\n${PHRASES_INSTRUCTION(1)}\n\nВерни только этот анонс.`
        : promptContext;
    }

    const layout =
      mode === 'phrases'
        ? `На странице журнала напечатаны ${parts.length} отдельных коротких фраз.`
        : `Этот текст напечатан ${parts.length} частями в разных блоках одной страницы журнала.`;

    return `${promptContext}\n\n${layout} Сейчас они такие:\n${current}\n\n${instruction}`;
  }

  /** `cleanPhrase` for a single standalone result — exposed so a rewritten phrase gets the same
   * cleanup as one generated as part of the whole set. */
  finalizePhrase(text: string): string {
    return cleanPhrase(text);
  }

  /** `mode: 'phrases'` — the phrases model and a higher temperature: cover lines need surprise,
   * and the cautious prose temperature is what pulls them towards the same safe clichés. */
  private async complete(
    messages: YandexGptMessage[],
    mode: CanvasAiTextChainMode = 'continuous',
  ): Promise<string> {
    const isPhrases = mode === 'phrases';
    const { data } = await firstValueFrom(
      this.http.post<YandexGptCompletionResponse>(
        this.apiUrl(),
        {
          modelUri: `gpt://${this.folderId()}/${isPhrases ? this.phrasesModel() : this.model()}`,
          completionOptions: {
            stream: false,
            temperature: isPhrases ? PHRASES_TEMPERATURE : 0.6,
            maxTokens: '2000',
          },
          messages,
        },
        { headers: { Authorization: `Api-Key ${this.apiKey()}` } },
      ),
    );

    const text = data.result.alternatives[0]?.message.text;
    if (!text) {
      throw new Error('YandexGPT returned no alternatives.');
    }

    return text.trim();
  }

  private apiUrl(): string {
    return (
      this.config.get<string>('yandexGpt.apiUrl') ??
      'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'
    );
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('yandexGpt.apiKey');
  }

  private folderId(): string | undefined {
    return this.config.get<string>('yandexGpt.folderId');
  }

  private phrasesModel(): string {
    return this.config.get<string>('yandexGpt.phrasesModel') ?? 'yandexgpt/latest';
  }

  private model(): string {
    return this.config.get<string>('yandexGpt.model') ?? 'yandexgpt-lite/latest';
  }
}
