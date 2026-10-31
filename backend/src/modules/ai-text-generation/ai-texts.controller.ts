import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AiUsageService, type AiUsageSubject } from './ai-usage.service';
import { DraftAiTextsService } from './draft-ai-texts.service';
import { GenerateDraftAiTextDto } from './dto/generate-draft-ai-text.dto';

/** Public + optional auth, like the guest photo gallery: a signed-in customer is billed by
 * account, a guest by their guestId + IP (see AiUsageService). */
@ApiTags('AI texts')
@ApiBearerAuth()
@Public()
@UseGuards(OptionalJwtAuthGuard)
@Controller('ai-texts')
export class AiTextsController {
  constructor(
    private readonly aiUsage: AiUsageService,
    private readonly draftAiTexts: DraftAiTextsService,
  ) {}

  @Get('usage')
  @ApiOperation({ summary: "Today's AI generation limit and how much of it is left" })
  @ApiQuery({ name: 'guestId', required: false })
  usage(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() request: Request,
    @Query('guestId') guestId?: string,
  ) {
    return this.aiUsage.getStatus(subjectOf(user, request, guestId));
  }

  // On top of the daily limit — stops a burst from one client before it reaches YandexGPT.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('draft/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate AI text for a journal not yet saved as an order (a guest's local draft)" })
  generateForDraft(
    @CurrentUser() user: JwtPayload | undefined,
    @Req() request: Request,
    @Body() dto: GenerateDraftAiTextDto,
  ) {
    return this.draftAiTexts.generate(dto, subjectOf(user, request, dto.guestId));
  }
}

function subjectOf(user: JwtPayload | undefined, request: Request, guestId: string | undefined): AiUsageSubject {
  return user ? { userId: user.sub } : { guestId, ip: request.ip };
}
