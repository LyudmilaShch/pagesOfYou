import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export enum AdminOrderSortField {
  CREATED_AT = 'createdAt',
  SUBMITTED_AT = 'submittedAt',
  TOTAL_PRICE = 'totalPrice',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetOrdersQueryDto {
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

  @ApiPropertyOptional({ description: 'Search by customer phone or name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Defaults to every status except DRAFT (i.e. only actually placed orders).',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: AdminOrderSortField, default: AdminOrderSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(AdminOrderSortField)
  sortBy?: AdminOrderSortField = AdminOrderSortField.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
