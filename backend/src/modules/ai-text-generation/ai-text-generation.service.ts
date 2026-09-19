import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { CanvasLengthConstraint } from '../../shared/types/canvas-data.types';

const SYSTEM_PROMPT =
  'Ты — редактор текста для персонального печатного журнала. Пиши тёплым, живым языком от ' +
  'первого лица там, где это уместно, используя только факты из ответов пользователя — ничего ' +
  'не выдумывай. В ответе верни ТОЛЬКО сам текст, без преамбул, пояснений, кавычек или заголовков.';

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
   * — this method only adds the system framing, the length-constraint line, and the retry loop. */
  async generateText(
    promptContext: string,
    lengthConstraint: CanvasLengthConstraint,
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      this.logger.warn('YandexGPT is not configured (YANDEX_GPT_API_KEY/YANDEX_GPT_FOLDER_ID) — skipping AI text generation.');
      return null;
    }

    const constraintLine = describeConstraint(lengthConstraint);
    const messages: YandexGptMessage[] = [
      { role: 'system', text: SYSTEM_PROMPT },
      {
        role: 'user',
        text: constraintLine ? `${promptContext}\n\nОграничение длины: ${constraintLine}.` : promptContext,
      },
    ];

    let lastText: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let text: string;
      try {
        text = await this.complete(messages);
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

  private async complete(messages: YandexGptMessage[]): Promise<string> {
    const { data } = await firstValueFrom(
      this.http.post<YandexGptCompletionResponse>(
        this.apiUrl(),
        {
          modelUri: `gpt://${this.folderId()}/${this.model()}`,
          completionOptions: { stream: false, temperature: 0.6, maxTokens: '2000' },
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

  private model(): string {
    return this.config.get<string>('yandexGpt.model') ?? 'yandexgpt-lite/latest';
  }
}
