import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ description: 'Минимальный срок изготовления журнала, рабочих дней' })
  @IsOptional()
  @IsInt()
  @Min(1)
  productionDaysMin?: number;

  @ApiPropertyOptional({ description: 'Максимальный срок изготовления журнала, рабочих дней' })
  @IsOptional()
  @IsInt()
  @Min(1)
  productionDaysMax?: number;

  @ApiPropertyOptional({ description: 'Перегенераций текста в сутки для пользователя (0 — выключено)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  aiDailyLimitUser?: number;

  @ApiPropertyOptional({ description: 'Защитный потолок первых ИИ-текстов в сутки — пользователь' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  aiDailyFillCapUser?: number;

  @ApiPropertyOptional({ description: 'Защитный потолок первых ИИ-текстов в сутки — гость (на IP — ×3)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  aiDailyFillCapGuest?: number;

  @ApiPropertyOptional({ description: 'Сколько раз текст блока у гостя обновляется сам после изменения ответов' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  aiGuestAutoUpdatesPerText?: number;
}
