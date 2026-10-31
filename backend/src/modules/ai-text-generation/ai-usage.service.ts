import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database';

/** Who a generation is billed to. A signed-in user is counted by account alone; a guest by BOTH
 * their client-generated guestId and their IP — the guestId alone is trivially reset by clearing
 * site data, the IP alone would lump together everyone behind one NAT. */
export interface AiUsageSubject {
  userId?: string;
  guestId?: string;
  ip?: string;
}

/**
 * - `fill` — a block's first text (and a guest's automatic update after an answer change, whose
 *   per-block budget lives in the guest's draft). Never limited visibly, so a journal can always be
 *   filled to the end — only the hidden daily cap against abuse applies.
 * - `regenerate` — 🔄 and a signed-in customer's update after an answer change: the daily limit
 *   shown as "осталось N". Not available to guests at all.
 */
export type AiUsageKind = 'fill' | 'regenerate';

export interface AiUsageStatus {
  isGuest: boolean;
  /** Today's regenerations — always 0 for a guest, who has none. */
  limit: number;
  used: number;
  remaining: number;
  /** The hidden cap on first texts is reached — new blocks stay unwritten until tomorrow. */
  fillCapReached: boolean;
  /** How many times a guest's block updates itself after an answer change. */
  guestAutoUpdatesPerText: number;
}

/** Keys reserved by one `reserve` call — handed back to `release` if the generation fails. */
export interface AiUsageReservation {
  keys: string[];
  day: string;
}

interface AiLimits {
  regenerateUser: number;
  fillCapUser: number;
  fillCapGuest: number;
  guestAutoUpdatesPerText: number;
}

/** The IP key allows this many times the per-guest cap — room for a family/office sharing an
 * address, while still capping one person cycling through fresh guestIds. */
const AI_GUEST_IP_LIMIT_MULTIPLIER = 3;

const SETTINGS_ID = 'default';

/** Shown on the client as-is — see the frontend's ai-usage handling. */
export const AI_LIMIT_REACHED_MESSAGE =
  'Лимит перегенераций на сегодня исчерпан. Текст можно поправить вручную — новые генерации станут доступны завтра.';
export const AI_FILL_CAP_REACHED_MESSAGE =
  'Сегодня ИИ уже не может писать новые тексты. Ответы сохранены — тексты можно будет создать завтра.';
export const AI_REGENERATE_GUEST_MESSAGE = 'Чтобы сгенерировать другой вариант текста, войдите в аккаунт.';

/**
 * Daily (UTC) counters on YandexGPT generations, kept separately per `AiUsageKind`. One unit = one
 * generated text: a standalone block, a whole chain generated together, or one rewritten part —
 * the retries inside a single generation aren't counted separately. Counters live in
 * `ai_usage_counters` (one row per key per day) and are incremented atomically with the limit
 * check in the same statement, so concurrent requests can't both slip past the last unit.
 */
@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(subject: AiUsageSubject): Promise<AiUsageStatus> {
    const isGuest = !subject.userId;
    const limits = await this.limits();
    const day = new Date(todayUtc());
    const regenerate = this.keysWithLimits(subject, 'regenerate', limits);
    const fill = this.keysWithLimits(subject, 'fill', limits);

    const rows = await this.prisma.aiUsageCounter.findMany({
      where: { day, subjectKey: { in: [...regenerate, ...fill].map((entry) => entry.key) } },
    });
    const countByKey = new Map(rows.map((row) => [row.subjectKey, row.count]));
    // The tightest of the subject's keys decides — for a guest that's usually the guestId one.
    const remainingOf = (entries: Array<{ key: string; limit: number }>) =>
      entries.length === 0
        ? 0
        : Math.max(0, Math.min(...entries.map((entry) => entry.limit - (countByKey.get(entry.key) ?? 0))));

    const limit = isGuest ? 0 : limits.regenerateUser;
    const remaining = remainingOf(regenerate);
    return {
      isGuest,
      limit,
      used: Math.max(0, limit - remaining),
      remaining,
      fillCapReached: remainingOf(fill) <= 0,
      guestAutoUpdatesPerText: limits.guestAutoUpdatesPerText,
    };
  }

  /** Takes one unit from every key of `subject` for `kind`, or none of them — `null` when any key
   * is already at its limit (or the subject can't be identified, or has no such kind at all). */
  async reserve(subject: AiUsageSubject, kind: AiUsageKind): Promise<AiUsageReservation | null> {
    const entries = this.keysWithLimits(subject, kind, await this.limits());
    // A limit of 0 (generation switched off for this kind of subject) must be caught here: the
    // INSERT branch below would otherwise create a fresh row at count 1 without ever checking it.
    if (entries.length === 0 || entries.some((entry) => entry.limit <= 0)) {
      return null;
    }

    const day = todayUtc();
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const entry of entries) {
          // Upsert-and-increment, but only while under the limit: an at-limit row matches the
          // conflict yet fails the WHERE, so RETURNING comes back empty.
          const rows = await tx.$queryRaw<Array<{ count: number }>>`
            INSERT INTO "ai_usage_counters" ("id", "subjectKey", "day", "count", "updatedAt")
            VALUES (${randomUUID()}, ${entry.key}, ${day}::date, 1, NOW())
            ON CONFLICT ("subjectKey", "day")
            DO UPDATE SET "count" = "ai_usage_counters"."count" + 1, "updatedAt" = NOW()
            WHERE "ai_usage_counters"."count" < ${entry.limit}
            RETURNING "count"`;
          if (rows.length === 0) {
            throw new LimitReachedSignal();
          }
        }
      });
    } catch (err) {
      if (err instanceof LimitReachedSignal) {
        return null;
      }
      throw err;
    }

    return { keys: entries.map((entry) => entry.key), day };
  }

  /** Gives back a reserved unit — the generation it was taken for produced nothing (YandexGPT
   * unavailable, not configured), and the customer shouldn't pay for that. */
  async release(reservation: AiUsageReservation): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "ai_usage_counters"
      SET "count" = GREATEST("count" - 1, 0), "updatedAt" = NOW()
      WHERE "day" = ${reservation.day}::date AND "subjectKey" IN (${Prisma.join(reservation.keys)})`;
  }

  /** `reserve`, throwing with a customer-facing message when nothing can be taken — 403 for a
   * guest asking to regenerate (sign-in required), 429 at a limit. */
  async reserveOrThrow(subject: AiUsageSubject, kind: AiUsageKind): Promise<AiUsageReservation> {
    if (kind === 'regenerate' && !subject.userId) {
      throw new ForbiddenException(AI_REGENERATE_GUEST_MESSAGE);
    }
    const reservation = await this.reserve(subject, kind);
    if (!reservation) {
      throw new HttpException(
        kind === 'regenerate' ? AI_LIMIT_REACHED_MESSAGE : AI_FILL_CAP_REACHED_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return reservation;
  }

  private keysWithLimits(
    subject: AiUsageSubject,
    kind: AiUsageKind,
    limits: AiLimits,
  ): Array<{ key: string; limit: number }> {
    if (kind === 'regenerate') {
      // Same key as before the fill/regenerate split, so today's count carries over.
      return subject.userId ? [{ key: `user:${subject.userId}`, limit: limits.regenerateUser }] : [];
    }
    if (subject.userId) {
      return [{ key: `fill:user:${subject.userId}`, limit: limits.fillCapUser }];
    }
    const entries: Array<{ key: string; limit: number }> = [];
    if (subject.guestId) {
      entries.push({ key: `fill:guest:${subject.guestId}`, limit: limits.fillCapGuest });
    }
    if (subject.ip) {
      entries.push({ key: `fill:ip:${subject.ip}`, limit: limits.fillCapGuest * AI_GUEST_IP_LIMIT_MULTIPLIER });
    }
    return entries;
  }

  private async limits(): Promise<AiLimits> {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
    return {
      regenerateUser: settings.aiDailyLimitUser,
      fillCapUser: settings.aiDailyFillCapUser,
      fillCapGuest: settings.aiDailyFillCapGuest,
      guestAutoUpdatesPerText: settings.aiGuestAutoUpdatesPerText,
    };
  }
}

class LimitReachedSignal extends Error {}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
