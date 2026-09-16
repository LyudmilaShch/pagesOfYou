import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

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
}
