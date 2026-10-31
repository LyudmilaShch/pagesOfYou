import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database';
import type { CanvasAiTextPlaceholder } from '../../shared/types/canvas-data.types';
import { findAiTextGroupOf, flattenTree } from '../../shared/utils/element-tree.util';
import { buildJournalPageSnapshot } from '../../shared/utils/journal-structure.util';
import {
  buildJournalPromptContext,
  buildQuestionsPromptContext,
  MAX_JOURNAL_CONTEXT_CHARS,
} from '../../shared/utils/ai-prompt-context.util';
import { AiTextGenerationService } from './ai-text-generation.service';
import { AiUsageService, type AiUsageKind, type AiUsageStatus, type AiUsageSubject } from './ai-usage.service';
import type { GenerateDraftAiTextDto } from './dto/generate-draft-ai-text.dto';

export interface DraftAiTextResult {
  /** elementId → generated text, for every part written by this call. */
  texts: Record<string, string>;
  usage: AiUsageStatus;
}

/**
 * AI text for a journal that lives only in the browser (a guest's local draft). The trust split:
 * the page — and so the admin's prompt, length limits, question bindings — is rebuilt here from
 * the template ids in the DB, exactly as the order flow builds a page snapshot; only the
 * customer's own content (answers, current part texts, the journal's other texts) comes from the
 * request, capped in size by the DTO. Billed against the same daily counters as the order flow —
 * by account when signed in, by guestId + IP otherwise.
 */
@Injectable()
export class DraftAiTextsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiTextGeneration: AiTextGenerationService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async generate(dto: GenerateDraftAiTextDto, subject: AiUsageSubject): Promise<DraftAiTextResult> {
    if (!subject.userId && !subject.guestId) {
      throw new BadRequestException('guestId is required when not signed in.');
    }

    const parts = await this.loadTextParts(dto);
    const target = parts.find((part) => part.id === dto.elementId)!;
    const lead = parts[0];

    const answerByKey = new Map(dto.answers.map((answer) => [answer.questionKey, answer.textValue ?? '']));
    const promptContext = await this.buildPromptContext(dto, lead, answerByKey);
    if (!promptContext) {
      throw new BadRequestException('Ни на один из связанных вопросов ещё нет ответа.');
    }

    // A guest's automatic update draws on the fill cap — its per-block budget is kept in the draft
    // itself; a signed-in customer's update is a regeneration like 🔄.
    const kind: AiUsageKind =
      dto.purpose === 'regenerate' || (dto.purpose === 'update' && subject.userId) ? 'regenerate' : 'fill';
    const reservation = await this.aiUsage.reserveOrThrow(subject, kind);
    const texts = await this.generateTexts(dto, parts, target, promptContext);
    if (!texts) {
      await this.aiUsage.release(reservation);
      throw new ServiceUnavailableException('Не удалось сгенерировать текст. Попробуйте ещё раз позже.');
    }

    return { texts, usage: await this.aiUsage.getStatus(subject) };
  }

  /** Rebuilds the page from its template(s) and finds the target text's parts on it. */
  private async loadTextParts(dto: GenerateDraftAiTextDto): Promise<CanvasAiTextPlaceholder[]> {
    const templateIds = [dto.page.magazinePageId, dto.page.rightMagazinePageId].filter(
      (id): id is string => Boolean(id),
    );
    const templates = await this.prisma.magazinePage.findMany({
      where: { id: { in: templateIds }, magazineTypeId: dto.magazineTypeId, deletedAt: null },
    });
    const primary = templates.find((template) => template.id === dto.page.magazinePageId);
    const right = templates.find((template) => template.id === dto.page.rightMagazinePageId) ?? null;
    if (!primary) {
      throw new NotFoundException('Шаблон страницы не найден.');
    }

    const snapshot = buildJournalPageSnapshot(dto.page.slotType, dto.page.layoutMode ?? null, primary, right);
    const parts = findAiTextGroupOf(flattenTree(snapshot.elements), dto.elementId);
    if (!parts) {
      throw new BadRequestException(`Element "${dto.elementId}" is not an AI-text placeholder.`);
    }
    return parts;
  }

  private async buildPromptContext(
    dto: GenerateDraftAiTextDto,
    lead: CanvasAiTextPlaceholder,
    answerByKey: Map<string, string>,
  ): Promise<string | null> {
    if (lead.contentSource === 'journal') {
      const questions = await this.prisma.question.findMany({
        where: { magazineTypeId: dto.magazineTypeId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
      });
      return buildJournalPromptContext(lead, questions, answerByKey, capJournalTexts(dto.journalTexts ?? []));
    }

    const questions = await this.prisma.question.findMany({
      where: { magazineTypeId: dto.magazineTypeId, key: { in: lead.questionKeys }, deletedAt: null },
    });
    return buildQuestionsPromptContext(
      lead,
      new Map(questions.map((question) => [question.key, question])),
      answerByKey,
    );
  }

  /** Same choice as the order flow: the whole text in one request, or one part rewritten alone
   * with the others as context (a lone phrase needs the cover-line instruction too). */
  private async generateTexts(
    dto: GenerateDraftAiTextDto,
    parts: CanvasAiTextPlaceholder[],
    target: CanvasAiTextPlaceholder,
    promptContext: string,
  ): Promise<Record<string, string> | null> {
    const lead = parts[0];

    if (dto.scope === 'all') {
      const generated = await this.aiTextGeneration.generateTextParts(
        promptContext,
        parts.map((part) => part.lengthConstraint),
        parts.map((part) => part.partHint),
        lead.chainMode,
      );
      return generated ? Object.fromEntries(parts.map((part, index) => [part.id, generated[index]])) : null;
    }

    const textByElementId = new Map((dto.currentTexts ?? []).map((item) => [item.elementId, item.text.trim()]));
    const context =
      parts.length > 1 || lead.chainMode === 'phrases'
        ? this.aiTextGeneration.buildPartRewriteContext(
            promptContext,
            parts.map((part) => ({
              text: textByElementId.get(part.id) ?? '',
              hint: part.partHint ?? '',
              isTarget: part.id === target.id,
            })),
            lead.chainMode,
          )
        : promptContext;

    const generated = await this.aiTextGeneration.generateText(context, target.lengthConstraint, lead.chainMode);
    if (!generated) {
      return null;
    }
    return {
      [target.id]: lead.chainMode === 'phrases' ? this.aiTextGeneration.finalizePhrase(generated) : generated,
    };
  }
}

function capJournalTexts(texts: string[]): string[] {
  const capped: string[] = [];
  let length = 0;
  for (const text of texts.map((item) => item.trim()).filter(Boolean)) {
    if (length + text.length > MAX_JOURNAL_CONTEXT_CHARS) {
      break;
    }
    capped.push(text);
    length += text.length;
  }
  return capped;
}
