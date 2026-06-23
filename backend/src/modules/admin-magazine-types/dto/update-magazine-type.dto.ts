import { PartialType } from '@nestjs/swagger';
import { CreateMagazineTypeDto } from './create-magazine-type.dto';

export class UpdateMagazineTypeDto extends PartialType(CreateMagazineTypeDto) {}
