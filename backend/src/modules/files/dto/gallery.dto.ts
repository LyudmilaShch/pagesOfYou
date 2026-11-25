import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class UploadImageDto {
  /** Real order's gallery — requires the caller to be authenticated and own the order. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  /** Guest gallery — an opaque client-generated token, no auth required. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  guestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;
}

export class SetFavoriteDto {
  @IsBoolean()
  isFavorite: boolean;
}

export class TouchGuestGalleryDto {
  @IsUUID()
  guestId: string;
}

export class ClaimGuestPhotosDto {
  @IsUUID()
  guestId: string;

  @IsString()
  @MinLength(1)
  orderId: string;
}

export class CreatePhoneUploadSessionDto {
  /** Real order's gallery — requires the caller to be authenticated and own the order. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  orderId?: string;

  /** Guest gallery — the same opaque token the computer already uses. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  guestId?: string;
}

export class RevokePhoneUploadSessionDto {
  @IsString()
  @MinLength(1)
  revokeToken: string;
}

/** Width and height travel as multipart fields, same as `UploadImageDto`. */
export class PhoneUploadImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;
}
