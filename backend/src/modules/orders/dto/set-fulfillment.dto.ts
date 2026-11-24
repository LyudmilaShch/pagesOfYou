import { ApiProperty } from '@nestjs/swagger';
import { OrderFulfillment } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetFulfillmentDto {
  @ApiProperty({ enum: OrderFulfillment, example: OrderFulfillment.PRINT })
  @IsEnum(OrderFulfillment)
  fulfillment!: OrderFulfillment;
}
