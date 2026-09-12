import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum PromoCodeSortField {
  CODE = 'code',
  CREATED_AT = 'createdAt',
  EXPIRES_AT = 'expiresAt',
  USAGE_COUNT = 'usageCount',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetPromoCodesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'PAGES', description: 'Search by code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PromoCodeSortField, default: PromoCodeSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(PromoCodeSortField)
  sortBy?: PromoCodeSortField = PromoCodeSortField.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
